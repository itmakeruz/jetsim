import { Injectable, Logger } from '@nestjs/common';
import { ResellerOrderState } from '@prisma/client';
import { PrismaService } from '@prisma';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { B2bAlerts, ProviderSubmitter, SubmitOutcome } from './provider-submitter';

export const OPEN_STATES: ResellerOrderState[] = ['RESERVED', 'SUBMITTING', 'SUBMITTED', 'RECONCILE'];

/**
 * Отправка заказа поставщику. Каждый переход состояния — условный UPDATE
 * (`WHERE state = <ожидаемое>`), поэтому параллельные воркеры, повторный вызов и
 * гонка с отменой не могут ни отправить заказ дважды, ни закрыть резерв дважды.
 */
@Injectable()
export class B2bIssuanceService {
  private readonly logger = new Logger(B2bIssuanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: ResellerLedgerService,
    private readonly submitter: ProviderSubmitter,
    private readonly alerts: B2bAlerts,
  ) {}

  /** Запускает отправку в фоне; если процесс упадёт до отправки, заказ подхватит крон (B2bSettlementService). */
  enqueue(resellerOrderId: number) {
    setImmediate(() => {
      this.submit(resellerOrderId).catch((e) => this.logger.error(`B2B submit ${resellerOrderId} failed: ${e?.message}`, e?.stack));
    });
  }

  async submit(resellerOrderId: number): Promise<void> {
    // 1. Захват: после этого отмена невозможна, а второй воркер ничего не сделает
    const claimed = await this.prisma.resellerOrder.updateMany({
      where: { id: resellerOrderId, state: 'RESERVED' },
      data: { state: 'SUBMITTING', submitting_at: new Date() },
    });
    if (claimed.count !== 1) return;

    const ro = await this.prisma.resellerOrder.findUniqueOrThrow({
      where: { id: resellerOrderId },
      include: { reseller: { include: { service_user: true } }, tariff: { include: { partner: true } } },
    });

    // 2. «Оболочка» заказа и SIM — чтобы работали существующие обработчики провайдеров и история событий
    const { order, sim } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: { status: 'CREATED', user_id: ro.reseller.service_user_id, reseller_order_id: ro.id },
      });
      const sim = await tx.sims.create({
        data: {
          status: 'CREATED',
          partner_id: ro.tariff.partner_id,
          order_id: order.id,
          user_id: ro.reseller.service_user_id,
          tariff_id: ro.tariff_id,
          reseller_order_id: ro.id,
        },
      });
      return { order, sim };
    });

    // 3. Вызов поставщика (ровно один)
    let outcome: SubmitOutcome;
    try {
      outcome = await this.submitter.submit({
        resellerOrderId: ro.id,
        orderId: order.id,
        simId: sim.id,
        userId: ro.reseller.service_user_id,
        userName: ro.reseller.name,
        partnerId: ro.tariff.partner_id,
        providerNumber: ro.tariff.partner?.identified_number ?? 0,
        tariff: { id: ro.tariff.id, sku_id: ro.tariff.sku_id, validity_period: ro.tariff.validity_period },
      });
    } catch (e: any) {
      // Исключение = не знаем, дошла ли заявка → никогда не освобождаем резерв автоматически
      outcome = { kind: 'UNKNOWN', reason: `submitter exception: ${e?.message ?? e}` };
    }

    await this.applyOutcome(ro.id, ro.reseller_id, ro.reseller.name, ro.price_kopecks, outcome);
  }

  private async applyOutcome(id: number, resellerId: number, resellerName: string, price: bigint, outcome: SubmitOutcome) {
    switch (outcome.kind) {
      case 'ACCEPTED':
        await this.prisma.resellerOrder.updateMany({
          where: { id, state: 'SUBMITTING' },
          data: { state: 'SUBMITTED', submitted_at: new Date(), provider_response: this.json(outcome.response) },
        });
        return;

      case 'REJECTED':
        await this.prisma.$transaction(async (tx) => {
          const moved = await tx.resellerOrder.updateMany({
            where: { id, state: 'SUBMITTING' },
            data: {
              state: 'FAILED',
              state_reason: `PROVIDER_REJECTED: ${outcome.reason}`.slice(0, 500),
              failed_at: new Date(),
              provider_response: this.json(outcome.response),
            },
          });
          if (moved.count !== 1) return;
          await this.ledger.release(tx, { resellerId, orderId: id, amount: price });
          await tx.order.updateMany({ where: { reseller_order_id: id }, data: { status: 'FAILED' } });
        });
        return;

      case 'UNKNOWN': {
        const moved = await this.prisma.resellerOrder.updateMany({
          where: { id, state: 'SUBMITTING' },
          data: { state: 'RECONCILE', state_reason: `UNKNOWN_OUTCOME: ${outcome.reason}`.slice(0, 500) },
        });
        if (moved.count === 1) {
          await this.alerts
            .reconcileNeeded({ resellerOrderId: id, resellerName, reason: outcome.reason })
            .catch((e) => this.logger.error(`B2B alert failed: ${e?.message}`));
        }
        return;
      }
    }
  }

  private json(v: unknown) {
    return v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as any);
  }
}
