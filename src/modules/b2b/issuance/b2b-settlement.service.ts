import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@prisma';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { B2bIssuanceService } from './b2b-issuance.service';
import { B2bAlerts } from './provider-submitter';

const RESERVED_STUCK_MS = 30_000;
const SUBMITTING_STUCK_MS = 5 * 60_000;
const WAITING_STATES = ['SUBMITTING', 'SUBMITTED', 'RECONCILE'] as const;

/**
 * Приводит деньги в соответствие с фактом выдачи (каждые 10 с).
 * Деньги двигаются ТОЛЬКО по подтверждённым фактам: eSIM выдана (SIM COMPLETED) → списание;
 * SIM FAILED по сообщению поставщика → освобождение. Неизвестный исход не освобождается никогда.
 */
@Injectable()
export class B2bSettlementService {
  private readonly logger = new Logger(B2bSettlementService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: ResellerLedgerService,
    private readonly issuance: B2bIssuanceService,
    private readonly alerts: B2bAlerts,
  ) {}

  @Cron('*/10 * * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.run();
    } catch (e: any) {
      this.logger.error(`B2B settlement tick failed: ${e?.message}`, e?.stack);
    } finally {
      this.running = false;
    }
  }

  async run() {
    await this.kickStuckReserved();
    await this.interruptStuckSubmitting();
    await this.settleCompleted();
    await this.settleFailed();
  }

  /** Заказ остался RESERVED (потеряли фоновый запуск) — запускаем отправку; захват атомарный, дубля не будет. */
  private async kickStuckReserved() {
    const rows = await this.prisma.resellerOrder.findMany({
      where: { state: 'RESERVED', created_at: { lt: new Date(Date.now() - RESERVED_STUCK_MS) } },
      select: { id: true },
      take: 50,
    });
    for (const r of rows) this.issuance.enqueue(r.id);
  }

  /** Процесс умер посреди отправки — было ли обращение к поставщику, неизвестно: на сверку, повтора не делаем. */
  private async interruptStuckSubmitting() {
    const rows = await this.prisma.resellerOrder.findMany({
      where: { state: 'SUBMITTING', submitting_at: { lt: new Date(Date.now() - SUBMITTING_STUCK_MS) } },
      include: { reseller: { select: { name: true } } },
      take: 50,
    });
    for (const r of rows) {
      const moved = await this.prisma.resellerOrder.updateMany({
        where: { id: r.id, state: 'SUBMITTING' },
        data: { state: 'RECONCILE', state_reason: 'UNKNOWN_OUTCOME: отправка прервана или не завершилась' },
      });
      if (moved.count === 1) {
        await this.alerts
          .reconcileNeeded({ resellerOrderId: r.id, resellerName: r.reseller.name, reason: 'отправка прервана или не завершилась' })
          .catch(() => undefined);
      }
    }
  }

  private async settleCompleted() {
    const rows = await this.prisma.resellerOrder.findMany({
      where: { state: { in: [...WAITING_STATES] }, sim: { status: 'COMPLETED' } },
      take: 50,
    });
    for (const r of rows) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const moved = await tx.resellerOrder.updateMany({
            where: { id: r.id, state: { in: [...WAITING_STATES] } },
            data: { state: 'ISSUED', issued_at: new Date(), state_reason: null },
          });
          if (moved.count !== 1) return;
          await this.ledger.capture(tx, { resellerId: r.reseller_id, orderId: r.id, amount: r.price_kopecks });
          await tx.order.updateMany({ where: { reseller_order_id: r.id }, data: { status: 'COMPLETED' } });
        });
      } catch (e: any) {
        this.logger.error(`capture failed for B2B order ${r.id}: ${e?.message}`);
      }
    }
  }

  private async settleFailed() {
    const rows = await this.prisma.resellerOrder.findMany({
      where: { state: { in: ['SUBMITTED', 'RECONCILE'] }, sim: { status: 'FAILED' } },
      take: 50,
    });
    for (const r of rows) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const moved = await tx.resellerOrder.updateMany({
            where: { id: r.id, state: { in: ['SUBMITTED', 'RECONCILE'] } },
            data: { state: 'FAILED', failed_at: new Date(), state_reason: 'PROVIDER_REPORTED_FAILURE' },
          });
          if (moved.count !== 1) return;
          await this.ledger.release(tx, { resellerId: r.reseller_id, orderId: r.id, amount: r.price_kopecks });
          await tx.order.updateMany({ where: { reseller_order_id: r.id }, data: { status: 'FAILED' } });
        });
      } catch (e: any) {
        this.logger.error(`release failed for B2B order ${r.id}: ${e?.message}`);
      }
    }
  }
}
