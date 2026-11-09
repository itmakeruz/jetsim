import { TransactionStatus } from '@prisma/client';
import { simPaymentStatus } from './sim-payment-status';

describe('simPaymentStatus', () => {
  it('does not confuse a created order with confirmed payment', () => {
    expect(simPaymentStatus({ transaction_id: 1, transactions: [{ id: 1, status: TransactionStatus.PENDING }] })).toBe(
      TransactionStatus.PENDING,
    );
  });
  it('uses the canonical transaction rather than a different payment attempt', () => {
    expect(
      simPaymentStatus({
        transaction_id: 1,
        transactions: [
          { id: 2, status: TransactionStatus.FAILED },
          { id: 1, status: TransactionStatus.SUCCESS },
        ],
      }),
    ).toBe(TransactionStatus.SUCCESS);
  });
  it('preserves refunded and failed payment outcomes', () => {
    for (const status of [TransactionStatus.REFUNDED, TransactionStatus.FAILED, TransactionStatus.CANCELED]) {
      expect(simPaymentStatus({ transaction_id: 1, transactions: [{ id: 1, status }] })).toBe(status);
    }
  });
  it('does not infer payment when no canonical transaction is available', () => {
    expect(simPaymentStatus()).toBeNull();
    expect(
      simPaymentStatus({ transaction_id: 9, transactions: [{ id: 1, status: TransactionStatus.SUCCESS }] }),
    ).toBeNull();
  });
});
