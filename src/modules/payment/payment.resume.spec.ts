import { PaymentService } from './payment.service';
import { BadGatewayException, ConflictException, NotFoundException } from '@nestjs/common';

describe('PaymentService.resumePayment', () => {
  function setup() {
    const transaction = {
      id: 5,
      status: 'PENDING',
      partner_transaction_id: BigInt(123),
      request: JSON.stringify({ payment_url: 'https://securepay.tbank.ru/test-payment' }),
    };
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue({ transaction_id: 5, status: 'CREATED' }) },
      transaction: { findFirst: jest.fn().mockResolvedValue(transaction) },
    };
    const bank = {
      getPaymentStatus: jest.fn().mockResolvedValue({ Success: true, Status: 'NEW' }),
      initPayment: jest.fn(),
    };
    const service = new PaymentService(
      prisma as any,
      {} as any,
      bank as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, prisma, bank, transaction };
  }
  it('reuses the existing URL and scopes the order and transaction to the owner', async () => {
    const { service, prisma, bank } = setup();
    const result = await service.resumePayment(10, 20, 'ru');
    expect(result.data.payment_url).toBe('https://securepay.tbank.ru/test-payment');
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 20, user_id: 10 } }));
    expect(prisma.transaction.findFirst).toHaveBeenNthCalledWith(1, { where: { id: 5, order_id: 20, user_id: 10 } });
    expect(bank.getPaymentStatus).toHaveBeenCalledWith(123);
    expect(bank.initPayment).not.toHaveBeenCalled();
  });
  it('returns 404 for an inaccessible order without contacting the bank', async () => {
    const { service, prisma, bank } = setup();
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.resumePayment(10, 20, 'ru')).rejects.toBeInstanceOf(NotFoundException);
    expect(bank.getPaymentStatus).not.toHaveBeenCalled();
  });
  it.each(['SUCCESS', 'REFUNDED', 'CANCELED', 'ERROR'])('refuses a %s transaction', async (status) => {
    const { service, transaction, bank } = setup();
    transaction.status = status;
    await expect(service.resumePayment(10, 20, 'ru')).rejects.toBeInstanceOf(ConflictException);
    expect(bank.getPaymentStatus).not.toHaveBeenCalled();
  });
  it('does not create a new payment when a historical URL is missing', async () => {
    const { service, transaction, bank } = setup();
    transaction.request = '{}';
    await expect(service.resumePayment(10, 20, 'ru')).rejects.toThrow('не сохранена');
    expect(bank.initPayment).not.toHaveBeenCalled();
  });
  it.each(['CONFIRMED', 'AUTHORIZED', 'AUTHORIZING', 'DEADLINE_EXPIRED', 'CANCELED'])(
    'refuses bank status %s',
    async (Status) => {
      const { service, bank } = setup();
      bank.getPaymentStatus.mockResolvedValue({ Success: true, Status });
      await expect(service.resumePayment(10, 20, 'ru')).rejects.toBeInstanceOf(ConflictException);
    },
  );
  it('returns a safe error on bank failure', async () => {
    const { service, bank } = setup();
    bank.getPaymentStatus.mockRejectedValue(new Error('secret provider payload'));
    await expect(service.resumePayment(10, 20, 'ru')).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('handles a webhook arriving while checking the bank', async () => {
    const { service, prisma, transaction } = setup();
    prisma.transaction.findFirst.mockResolvedValueOnce(transaction).mockResolvedValueOnce(null);
    await expect(service.resumePayment(10, 20, 'ru')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PaymentService.preparePayment link persistence', () => {
  it('stores the bank URL without writing transaction status or webhook response', async () => {
    const update = jest.fn();
    const bank = {
      initPayment: jest
        .fn()
        .mockResolvedValue({ Success: true, PaymentId: 123, PaymentURL: 'https://securepay.tbank.ru/test-payment' }),
    };
    const service = new PaymentService(
      { transaction: { update } } as any,
      {} as any,
      bank as any,
      {} as any,
      {} as any,
      {} as any,
      { record: jest.fn() } as any,
    );
    jest.spyOn(service, 'getPaymentInfos').mockResolvedValue({
      data: {
        transaction: { transactionId: 5 },
        user: { email: 'traveler@example.invalid' },
        order: { id: 20, totalAmount: 10000, originalAmount: 10000, discountAmount: 0 },
        promo: null,
        items: [],
      },
    } as any);
    await service.preparePayment(10, 'ru');
    const saved = update.mock.calls[1][0];
    expect(JSON.parse(saved.data.request).payment_url).toBe('https://securepay.tbank.ru/test-payment');
    expect(saved.data).not.toHaveProperty('status');
    expect(saved.data).not.toHaveProperty('response');
  });
});
