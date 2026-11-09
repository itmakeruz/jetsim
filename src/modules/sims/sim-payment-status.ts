import { TransactionStatus } from '@prisma/client';

type PaymentOrder = {
  transaction_id?: number | null;
  transactions?: { id: number; status: TransactionStatus }[];
};

/** Exposes only the canonical transaction's status; never payment credentials or URLs. */
export function simPaymentStatus(order?: PaymentOrder | null): TransactionStatus | null {
  const transactions = order?.transactions ?? [];
  if (order?.transaction_id != null) {
    return transactions.find((transaction) => transaction.id === order.transaction_id)?.status ?? null;
  }
  return transactions[0]?.status ?? null;
}
