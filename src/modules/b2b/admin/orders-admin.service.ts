import { Injectable } from '@nestjs/common';
import { Prisma, ResellerOrderState } from '@prisma/client';
import { PrismaService } from '@prisma';
import { InvalidStateException, OrderNotFoundException } from '../b2b.errors';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { presentAdminOrder } from '../presenters';
import { CancelOrderDto, PageQueryDto, RefundOrderDto, ResolveOrderDto } from './dto/admin.dto';

const STATES = new Set<string>(['RESERVED', 'SUBMITTING', 'SUBMITTED', 'ISSUED', 'FAILED', 'RECONCILE', 'CANCELLED', 'REFUNDED']);

/** Операции суперадмина над заказами: просмотр со служебными данными, отмена, сверка, возврат. */
@Injectable()
export class OrdersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: ResellerLedgerService,
  ) {}

  async list(q: PageQueryDto) {
    const where: Prisma.ResellerOrderWhereInput = {
      ...(q.reseller_id ? { reseller_id: q.reseller_id } : {}),
      ...(q.state && STATES.has(q.state) ? { state: q.state as ResellerOrderState } : {}),
      ...(q.before_id ? { id: { lt: q.before_id } } : {}),
    };
    const rows = await this.prisma.resellerOrder.findMany({
      where,
      orderBy: { id: 'desc' },
      take: Math.min(q.size ?? 50, 200),
      include: { reseller: { select: { name: true } }, sim: { select: { id: true, status: true, iccid: true } } },
    });
    return rows.map((r) => ({ ...presentAdminOrder(r), sim_id: r.sim?.id ?? null, sim_status: r.sim?.status ?? null, iccid: r.sim?.iccid ?? null }));
  }

  async get(id: number) {
    const r = await this.prisma.resellerOrder.findUnique({
      where: { id },
      include: { reseller: { select: { name: true } }, sim: { select: { id: true, status: true, iccid: true, response: true } }, order: { select: { id: true } } },
    });
    if (!r) throw new OrderNotFoundException();
    return {
      ...presentAdminOrder(r),
      sim_id: r.sim?.id ?? null,
      sim_status: r.sim?.status ?? null,
      iccid: r.sim?.iccid ?? null,
      shell_order_id: r.order?.id ?? null,
      sim_provider_response: r.sim?.response ?? null,
    };
  }

  /** Только до отправки поставщику: RESERVED → CANCELLED + освобождение резерва. */
  async cancel(id: number, dto: CancelOrderDto, actor: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.resellerOrder.updateMany({
        where: { id, state: 'RESERVED' },
        data: { state: 'CANCELLED', state_reason: `CANCELLED_BY_ADMIN: ${dto.comment}${actor ? ` (${actor})` : ''}`.slice(0, 500) },
      });
      if (moved.count !== 1) {
        const o = await tx.resellerOrder.findUnique({ where: { id }, select: { state: true } });
        if (!o) throw new OrderNotFoundException();
        throw new InvalidStateException(
          'Заявка уже отправлена поставщику: отмена невозможна. Используйте сверку и подтверждённый возврат.',
        );
      }
      const o = await tx.resellerOrder.findUniqueOrThrow({ where: { id } });
      await this.ledger.release(tx, { resellerId: o.reseller_id, orderId: id, amount: o.price_kopecks });
    });
    return this.get(id);
  }

  /** Сверка заказа с неизвестным исходом: суперадмин устанавливает факт по данным поставщика. */
  async reconcile(id: number, dto: ResolveOrderDto, actor: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const target = dto.outcome === 'ISSUED' ? 'ISSUED' : 'FAILED';
      const moved = await tx.resellerOrder.updateMany({
        where: { id, state: 'RECONCILE' },
        data: {
          state: target,
          state_reason: `RECONCILED_${target}: ${dto.comment}${actor ? ` (${actor})` : ''}`.slice(0, 500),
          ...(target === 'ISSUED' ? { issued_at: new Date() } : { failed_at: new Date() }),
        },
      });
      if (moved.count !== 1) {
        const o = await tx.resellerOrder.findUnique({ where: { id }, select: { state: true } });
        if (!o) throw new OrderNotFoundException();
        throw new InvalidStateException('Сверка возможна только для заказов в состоянии RECONCILE');
      }
      const o = await tx.resellerOrder.findUniqueOrThrow({ where: { id } });
      if (target === 'ISSUED') {
        await this.ledger.capture(tx, { resellerId: o.reseller_id, orderId: id, amount: o.price_kopecks });
        await tx.order.updateMany({ where: { reseller_order_id: id }, data: { status: 'COMPLETED' } });
      } else {
        await this.ledger.release(tx, { resellerId: o.reseller_id, orderId: id, amount: o.price_kopecks });
        // Закрываем и SIM, чтобы запоздалый колбэк не «оживил» заказ, за который деньги уже освобождены
        await tx.sims.updateMany({ where: { reseller_order_id: id, status: { not: 'COMPLETED' } }, data: { status: 'FAILED' } });
        await tx.order.updateMany({ where: { reseller_order_id: id }, data: { status: 'FAILED' } });
      }
    });
    return this.get(id);
  }

  /** Возврат после выдачи: только для ISSUED и только с подтверждением, что поставщик вернул деньги. */
  async refund(id: number, dto: RefundOrderDto, actor: string | null) {
    if (!dto.provider_confirmed) {
      throw new InvalidStateException('Возврат возможен только после подтверждения возврата поставщиком (provider_confirmed=true)');
    }
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.resellerOrder.updateMany({
        where: { id, state: 'ISSUED' },
        data: { state: 'REFUNDED', state_reason: `REFUNDED: ${dto.comment}${actor ? ` (${actor})` : ''}`.slice(0, 500) },
      });
      if (moved.count !== 1) {
        const o = await tx.resellerOrder.findUnique({ where: { id }, select: { state: true } });
        if (!o) throw new OrderNotFoundException();
        throw new InvalidStateException('Возврат возможен только для выданных (ISSUED) заказов');
      }
      const o = await tx.resellerOrder.findUniqueOrThrow({ where: { id } });
      await this.ledger.refund(tx, {
        resellerId: o.reseller_id,
        orderId: id,
        amount: o.price_kopecks,
        comment: dto.comment,
        actor: actor ?? undefined,
      });
    });
    return this.get(id);
  }
}
