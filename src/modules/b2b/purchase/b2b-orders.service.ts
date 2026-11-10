import { Injectable } from '@nestjs/common';
import { Prisma, ResellerOrder } from '@prisma/client';
import { PrismaService } from '@prisma';
import { createHash } from 'crypto';
import {
  IdempotencyConflictException,
  OrderNotFoundException,
  PriceChangedException,
  ResellerBlockedException,
  TariffUnavailableException,
} from '../b2b.errors';
import { B2bIssuanceService } from '../issuance/b2b-issuance.service';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { CreateB2bOrderDto, ListB2bOrdersQueryDto } from './dto/purchase.dto';

const SUPPORTED_PROVIDERS = [1, 2, 3];

export function requestHash(input: { tariffId: number; priceVersion: number }): string {
  return createHash('sha256').update(JSON.stringify({ t: input.tariffId, v: input.priceVersion })).digest('hex');
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class B2bOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: ResellerLedgerService,
    private readonly issuance: B2bIssuanceService,
  ) {}

  /**
   * Создаёт заказ и атомарно резервирует закупочную стоимость.
   * Идемпотентность по (компания, client_order_id): тот же запрос → тот же заказ,
   * другое содержимое → IDEMPOTENCY_CONFLICT. Повтор допустим и у заблокированной компании.
   */
  async create(resellerId: number, dto: CreateB2bOrderDto): Promise<{ order: ResellerOrder; created: boolean }> {
    const hash = requestHash({ tariffId: dto.tariff_id, priceVersion: dto.price_version });

    const existing = await this.findByClientId(resellerId, dto.client_order_id);
    if (existing) return { order: this.assertSameRequest(existing, hash), created: false };

    let order: ResellerOrder;
    try {
      order = await this.prisma.$transaction((tx) => this.createInTx(tx, resellerId, dto, hash), { timeout: 15_000 });
    } catch (e) {
      // Параллельный дубль выиграл гонку по уникальному индексу — отдаём его заказ
      if (isUniqueViolation(e)) {
        const winner = await this.findByClientId(resellerId, dto.client_order_id);
        if (winner) return { order: this.assertSameRequest(winner, hash), created: false };
      }
      throw e;
    }

    this.issuance.enqueue(order.id);
    return { order, created: true };
  }

  private async createInTx(tx: Prisma.TransactionClient, resellerId: number, dto: CreateB2bOrderDto, hash: string) {
    // Компанию и тариф проверяем заново на каждой покупке, а не доверяем каталогу клиента
    const reseller = await tx.reseller.findUnique({ where: { id: resellerId } });
    if (!reseller || reseller.status !== 'ACTIVE') throw new ResellerBlockedException();

    const rt = await tx.resellerTariff.findUnique({
      where: { reseller_id_tariff_id: { reseller_id: resellerId, tariff_id: dto.tariff_id } },
      include: { tariff: { include: { partner: true } } },
    });
    if (
      !rt ||
      !rt.active ||
      rt.tariff.deleted_at ||
      rt.tariff.status !== 'ACTIVE' ||
      !SUPPORTED_PROVIDERS.includes(rt.tariff.partner?.identified_number ?? 0)
    ) {
      throw new TariffUnavailableException();
    }
    if (rt.price_version !== dto.price_version) throw new PriceChangedException();

    // Название, цена и срок фиксируются в заказе и не меняются задним числом
    const order = await tx.resellerOrder.create({
      data: {
        reseller_id: resellerId,
        client_order_id: dto.client_order_id,
        request_hash: hash,
        tariff_id: rt.tariff_id,
        tariff_name_ru: rt.tariff.name_ru,
        tariff_name_en: rt.tariff.name_en,
        data_gb: rt.tariff.quantity_internet,
        validity_days: rt.tariff.validity_period,
        price_kopecks: rt.price_kopecks,
        cost_kopecks: rt.tariff.price_arrival == null ? null : BigInt(rt.tariff.price_arrival) * 100n,
        cost_currency: rt.tariff.price_arrival == null ? null : 'RUB',
        provider_name: rt.tariff.partner.name_en,
        price_version: rt.price_version,
        currency: reseller.currency,
        source: dto.source ?? null,
        source_ref: dto.source_ref ?? null,
      },
    });
    await this.ledger.reserve(tx, { resellerId, orderId: order.id, amount: rt.price_kopecks });
    return order;
  }

  private assertSameRequest(order: ResellerOrder, hash: string): ResellerOrder {
    if (order.request_hash !== hash) throw new IdempotencyConflictException();
    return order;
  }

  findByClientId(resellerId: number, clientOrderId: string) {
    return this.prisma.resellerOrder.findUnique({
      where: { reseller_id_client_order_id: { reseller_id: resellerId, client_order_id: clientOrderId } },
    });
  }

  /** Чужой и несуществующий заказ неотличимы: 404 в обоих случаях. */
  async getForReseller(resellerId: number, clientOrderId: string): Promise<ResellerOrder> {
    const order = await this.findByClientId(resellerId, clientOrderId);
    if (!order) throw new OrderNotFoundException();
    return order;
  }

  async listForReseller(resellerId: number, q: ListB2bOrdersQueryDto) {
    const limit = q.limit ?? 50;
    if (q.updated_since) {
      return this.prisma.resellerOrder.findMany({
        where: { reseller_id: resellerId, updated_at: { gte: new Date(q.updated_since) } },
        orderBy: [{ updated_at: 'asc' }, { id: 'asc' }],
        take: limit,
      });
    }
    return this.prisma.resellerOrder.findMany({
      where: { reseller_id: resellerId, ...(q.before_id ? { id: { lt: q.before_id } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
    });
  }
}
