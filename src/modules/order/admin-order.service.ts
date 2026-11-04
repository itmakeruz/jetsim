import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, Status, TransactionStatus } from '@prisma/client';
import { PrismaService } from '@prisma';
import { PartnerIds } from '@enums';
import { OrderEventsService } from 'src/modules/order-events/order-events.service';
import { CreateAdminOrderDto } from './dto';
import { OrderService } from './order.service';

const SUPPORTED_PROVIDERS: number[] = [PartnerIds.JOYTEL, PartnerIds.BILLION_CONNECT, PartnerIds.MOBILINE];

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'наличные',
  CARD: 'карта',
  TRANSFER: 'перевод',
  OTHER: 'другое',
};

/**
 * Заказ из админки: сотрудник подбирает тариф и клиента, принимает оплату сам (наличные/карта/перевод),
 * система создаёт оплаченную транзакцию и запускает ту же выдачу eSIM, что и после онлайн-оплаты.
 */
@Injectable()
export class AdminOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
    private readonly orderEvents: OrderEventsService,
  ) {}

  async create(dto: CreateAdminOrderDto, staff: { id: number; role?: string }) {
    const quantity = dto.quantity ?? 1;
    const email = dto.client_email.trim().toLowerCase();

    const tariff = await this.prisma.tariff.findFirst({
      where: { id: dto.tariff_id, deleted_at: null },
      include: { partner: { select: { identified_number: true } } },
    });
    if (!tariff) throw new NotFoundException('Тариф не найден');
    if (
      tariff.status !== Status.ACTIVE ||
      !SUPPORTED_PROVIDERS.includes(tariff.partner?.identified_number ?? 0) ||
      !tariff.price_sell
    ) {
      throw new BadRequestException('Тариф недоступен для продажи');
    }

    const amount = tariff.price_sell * quantity;
    const manual = {
      manual: true,
      request_id: dto.request_id ?? null,
      payment_method: dto.payment_method,
      comment: dto.comment ?? null,
      created_by: { staff_id: staff.id, role: staff.role ?? null },
      quantity,
    };

    // Всё до выдачи — в одной транзакции под advisory-локом request_id: двойной клик/ретрай не создаст второй заказ
    const { orderId, userId, transactionId, existing } = await this.prisma.$transaction(async (tx) => {
      if (dto.request_id) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'admin-order:' + dto.request_id}))`;
        const prev = await tx.transaction.findFirst({
          where: { request: { path: ['request_id'], equals: dto.request_id } },
          select: { id: true, order_id: true, user_id: true },
        });
        if (prev?.order_id) return { orderId: prev.order_id, userId: prev.user_id!, transactionId: prev.id, existing: true };
      }

      // Клиент — по email среди обычных покупателей (служебные пользователи B2B не трогаем)
      let user = await tx.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, is_service: false },
        orderBy: { id: 'asc' },
      });
      if (!user) {
        user = await tx.user.create({
          data: { email, name: dto.client_name ?? null, phone_number: dto.client_phone ?? null, is_verified: true },
        });
      } else if ((!user.name && dto.client_name) || (!user.phone_number && dto.client_phone)) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            ...(!user.name && dto.client_name ? { name: dto.client_name } : {}),
            ...(!user.phone_number && dto.client_phone ? { phone_number: dto.client_phone } : {}),
          },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          amount: amount.toString(),
          status: TransactionStatus.SUCCESS,
          user_id: user.id,
          request: manual as Prisma.InputJsonValue,
        },
      });
      const order = await tx.order.create({
        data: { transaction_id: transaction.id, user_id: user.id, status: OrderStatus.CREATED },
      });
      await tx.transaction.update({ where: { id: transaction.id }, data: { order_id: order.id } });
      for (let i = 0; i < quantity; i++) {
        await tx.sims.create({
          data: { user_id: user.id, order_id: order.id, partner_id: tariff.partner_id, tariff_id: tariff.id, status: OrderStatus.CREATED },
        });
      }
      return { orderId: order.id, userId: user.id, transactionId: transaction.id, existing: false };
    });

    if (!existing) {
      await this.orderEvents.record({
        orderId,
        event: 'manual_order_created',
        message: `Заказ создан сотрудником в админке (${quantity} eSIM, тариф «${tariff.name_ru}»)`,
        meta: { staffId: staff.id, quantity, amount, comment: dto.comment ?? null },
      });
      await this.orderEvents.record({
        orderId,
        event: 'payment_manual_confirmed',
        message: `Оплата принята сотрудником вручную: ${PAYMENT_LABEL[dto.payment_method]}`,
        meta: { staffId: staff.id, paymentMethod: dto.payment_method, transactionId },
      });
      // Дальше — тот же путь, что после онлайн-оплаты: отправка поставщику и письмо клиенту
      await this.orders.create(userId, transactionId);
    }

    return this.result(orderId, existing);
  }

  private async result(orderId: number, existing: boolean) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        user: { select: { id: true, name: true, email: true } },
        sims: { select: { id: true, status: true, iccid: true }, orderBy: { id: 'asc' } },
      },
    });
    const ok = order.status === OrderStatus.COMPLETED;
    return {
      success: ok,
      message: existing
        ? 'Заказ с этим request_id уже был создан'
        : ok
          ? 'Заказ оформлен, eSIM отправлена клиенту'
          : 'Заказ создан, но выдача eSIM не завершена — смотрите историю заказа',
      data: { order_id: order.id, status: order.status, client: order.user, sims: order.sims, repeated: existing },
    };
  }
}
