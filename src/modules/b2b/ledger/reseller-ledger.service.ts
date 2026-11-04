import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResellerLedger, ResellerLedgerType } from '@prisma/client';
import { PrismaService } from '@prisma';
import { IdempotencyConflictException, InsufficientFundsException, InvalidAmountException, InvalidStateException } from '../b2b.errors';
import { Kopecks } from './money';

export type Tx = Prisma.TransactionClient;

export interface LedgerOp {
  resellerId: number;
  type: ResellerLedgerType;
  /** Изменение «оседлых» денег (пополнение/списание/возврат) */
  deltaBalance: Kopecks;
  /** Изменение резерва */
  deltaReserved: Kopecks;
  /** reseller_order.id, если проводка относится к заказу */
  orderId?: number | null;
  comment?: string | null;
  actor?: string | null;
  idempotencyKey: string;
}

export interface LedgerApplyResult {
  /** false — такая проводка уже была (тот же ключ идемпотентности), ничего не изменилось */
  applied: boolean;
  entry: ResellerLedger;
}

export interface Balance {
  balance: Kopecks;
  reserved: Kopecks;
  available: Kopecks;
}

/**
 * Единственный достоверный денежный баланс компании.
 *
 * Правила (из ТЗ):
 *  - покупка атомарно резервирует закупочную стоимость;
 *  - подтверждённая выдача превращает резерв в списание (capture);
 *  - достоверный отказ освобождает резерв (release) — ровно один раз;
 *  - параллельные запросы не уводят доступный баланс в минус;
 *  - журнал неизменяем — исправления только новыми проводками.
 *
 * Все операции одной компании сериализуются блокировкой строки счёта
 * (SELECT … FOR UPDATE) внутри транзакции вызывающего; в БД дополнительно стоят
 * CHECK на неотрицательность и триггер, запрещающий UPDATE/DELETE журнала.
 */
@Injectable()
export class ResellerLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(tx: Tx, op: LedgerOp): Promise<LedgerApplyResult> {
    const rows = await tx.$queryRaw<{ balance_kopecks: bigint; reserved_kopecks: bigint }[]>`
      SELECT balance_kopecks, reserved_kopecks
      FROM reseller_account
      WHERE reseller_id = ${op.resellerId}
      FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Счёт компании не найден');
    const { balance_kopecks: balance, reserved_kopecks: reserved } = rows[0];

    // Повтор той же операции — не двигаем деньги второй раз
    const existing = await tx.resellerLedger.findUnique({
      where: { reseller_id_idempotency_key: { reseller_id: op.resellerId, idempotency_key: op.idempotencyKey } },
    });
    if (existing) {
      const same =
        existing.type === op.type &&
        existing.delta_balance_kopecks === op.deltaBalance &&
        existing.delta_reserved_kopecks === op.deltaReserved;
      if (!same) throw new IdempotencyConflictException();
      return { applied: false, entry: existing };
    }

    if (op.orderId) await this.assertOrderLifecycle(tx, op);

    const nextBalance = balance + op.deltaBalance;
    const nextReserved = reserved + op.deltaReserved;
    if (nextBalance - nextReserved < 0n) throw new InsufficientFundsException();
    if (nextReserved < 0n || nextBalance < 0n) throw new InvalidStateException('Резерв не может быть отрицательным');

    await tx.resellerAccount.update({
      where: { reseller_id: op.resellerId },
      data: { balance_kopecks: nextBalance, reserved_kopecks: nextReserved },
    });
    const entry = await tx.resellerLedger.create({
      data: {
        reseller_id: op.resellerId,
        type: op.type,
        delta_balance_kopecks: op.deltaBalance,
        delta_reserved_kopecks: op.deltaReserved,
        balance_after: nextBalance,
        reserved_after: nextReserved,
        reseller_order_id: op.orderId ?? null,
        comment: op.comment ?? null,
        actor: op.actor ?? null,
        idempotency_key: op.idempotencyKey,
      },
    });
    return { applied: true, entry };
  }

  /**
   * RESERVE → ровно один; CAPTURE/RELEASE — только после RESERVE и только один из них
   * на ту же сумму; REFUND — только после CAPTURE, один раз, на ту же сумму.
   */
  private async assertOrderLifecycle(tx: Tx, op: LedgerOp) {
    const entries = await tx.resellerLedger.findMany({
      where: { reseller_order_id: op.orderId },
      select: { type: true, delta_reserved_kopecks: true, delta_balance_kopecks: true },
    });
    const has = (t: ResellerLedgerType) => entries.some((e) => e.type === t);
    const reserve = entries.find((e) => e.type === 'RESERVE');
    const capture = entries.find((e) => e.type === 'CAPTURE');

    switch (op.type) {
      case 'RESERVE':
        if (has('RESERVE')) throw new InvalidStateException('Резерв по этому заказу уже создан');
        break;
      case 'CAPTURE':
      case 'RELEASE':
        if (!reserve) throw new InvalidStateException('По заказу нет резерва');
        if (has('CAPTURE') || has('RELEASE')) throw new InvalidStateException('Резерв по заказу уже закрыт');
        if (-op.deltaReserved !== reserve.delta_reserved_kopecks) {
          throw new InvalidStateException('Сумма не совпадает с резервом заказа');
        }
        break;
      case 'REFUND':
        if (!capture) throw new InvalidStateException('Возврат возможен только после списания');
        if (has('REFUND')) throw new InvalidStateException('Возврат по заказу уже оформлен');
        if (op.deltaBalance !== -capture.delta_balance_kopecks) {
          throw new InvalidStateException('Сумма возврата не совпадает со списанием');
        }
        break;
    }
  }

  reserve(tx: Tx, p: { resellerId: number; orderId: number; amount: Kopecks }) {
    return this.apply(tx, {
      resellerId: p.resellerId,
      type: 'RESERVE',
      deltaBalance: 0n,
      deltaReserved: p.amount,
      orderId: p.orderId,
      idempotencyKey: `order:${p.orderId}:reserve`,
    });
  }

  capture(tx: Tx, p: { resellerId: number; orderId: number; amount: Kopecks }) {
    return this.apply(tx, {
      resellerId: p.resellerId,
      type: 'CAPTURE',
      deltaBalance: -p.amount,
      deltaReserved: -p.amount,
      orderId: p.orderId,
      idempotencyKey: `order:${p.orderId}:capture`,
    });
  }

  release(tx: Tx, p: { resellerId: number; orderId: number; amount: Kopecks }) {
    return this.apply(tx, {
      resellerId: p.resellerId,
      type: 'RELEASE',
      deltaBalance: 0n,
      deltaReserved: -p.amount,
      orderId: p.orderId,
      idempotencyKey: `order:${p.orderId}:release`,
    });
  }

  refund(tx: Tx, p: { resellerId: number; orderId: number; amount: Kopecks; comment: string; actor?: string }) {
    return this.apply(tx, {
      resellerId: p.resellerId,
      type: 'REFUND',
      deltaBalance: p.amount,
      deltaReserved: 0n,
      orderId: p.orderId,
      comment: p.comment,
      actor: p.actor,
      idempotencyKey: `order:${p.orderId}:refund`,
    });
  }

  /** Пополнение — только суперадмин; комментарий обязателен. */
  async topUp(p: { resellerId: number; amount: Kopecks; comment: string; actor?: string; idempotencyKey: string }) {
    if (p.amount <= 0n) throw new InvalidAmountException('Сумма пополнения должна быть больше нуля');
    this.requireComment(p.comment);
    return this.prisma.$transaction((tx) =>
      this.apply(tx, {
        resellerId: p.resellerId,
        type: 'TOPUP',
        deltaBalance: p.amount,
        deltaReserved: 0n,
        comment: p.comment.trim(),
        actor: p.actor,
        idempotencyKey: p.idempotencyKey,
      }),
    );
  }

  /** Корректировка ± — только суперадмин; комментарий обязателен; доступный баланс в минус не уходит. */
  async adjust(p: { resellerId: number; amount: Kopecks; comment: string; actor?: string; idempotencyKey: string }) {
    if (p.amount === 0n) throw new InvalidAmountException('Сумма корректировки не может быть нулевой');
    this.requireComment(p.comment);
    return this.prisma.$transaction((tx) =>
      this.apply(tx, {
        resellerId: p.resellerId,
        type: 'ADJUSTMENT',
        deltaBalance: p.amount,
        deltaReserved: 0n,
        comment: p.comment.trim(),
        actor: p.actor,
        idempotencyKey: p.idempotencyKey,
      }),
    );
  }

  private requireComment(comment: string) {
    if (!comment || comment.trim().length < 3) throw new InvalidAmountException('Комментарий обязателен');
  }

  async getBalance(resellerId: number, tx: Tx | PrismaService = this.prisma): Promise<Balance> {
    const account = await tx.resellerAccount.findUnique({ where: { reseller_id: resellerId } });
    if (!account) throw new NotFoundException('Счёт компании не найден');
    return {
      balance: account.balance_kopecks,
      reserved: account.reserved_kopecks,
      available: account.balance_kopecks - account.reserved_kopecks,
    };
  }

  async listLedger(resellerId: number, opts: { limit?: number; beforeId?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    return this.prisma.resellerLedger.findMany({
      where: { reseller_id: resellerId, ...(opts.beforeId ? { id: { lt: opts.beforeId } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
    });
  }
}
