import { PaymentService } from './payment.service';
import { TransactionStatus } from '@prisma/client';

/**
 * Проверочный крон для оплат, чей вебхук от Т-Банка задержался или потерялся:
 * спрашиваем статус сами (PaymentId сохранён сразу на шаге preparePayment,
 * из ответа Init — не нужно ждать вебхук, чтобы его узнать).
 */
describe('PaymentService.checkPendingPayments', () => {
  function buildService(overrides: {
    pendingTransactions?: any[];
    getPaymentStatus?: jest.Mock;
    updateManyResult?: { count: number };
  }) {
    const transactionFindMany = jest.fn().mockResolvedValue(overrides.pendingTransactions ?? []);
    const transactionUpdateMany = jest.fn().mockResolvedValue(overrides.updateManyResult ?? { count: 1 });

    const prisma = {
      transaction: {
        findMany: transactionFindMany,
        updateMany: transactionUpdateMany,
      },
    };

    const tbank = {
      getPaymentStatus: overrides.getPaymentStatus ?? jest.fn(),
    };

    const orderEvents = { record: jest.fn() };
    const promoCodeService = { confirmUsageByTransaction: jest.fn(), cancelUsageByTransaction: jest.fn() };
    const socketGateway = { sendPaymentStatus: jest.fn() };
    const orderService = { create: jest.fn() };

    const service = new PaymentService(
      prisma as any,
      { log: jest.fn(), error: jest.fn(), warn: jest.fn() } as any,
      tbank as any,
      orderService as any,
      socketGateway as any,
      promoCodeService as any,
      orderEvents as any,
    );

    return { service, prisma, tbank, orderEvents, promoCodeService, transactionFindMany, transactionUpdateMany };
  }

  it('запрашивает только PENDING-транзакции, у которых уже есть PaymentId', async () => {
    const { service, transactionFindMany } = buildService({ pendingTransactions: [] });

    await service.checkPendingPayments();

    expect(transactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: TransactionStatus.PENDING,
          partner_transaction_id: { not: null },
        }),
      }),
    );
  });

  it('подтверждает оплату, если Т-Банк отвечает CONFIRMED, хотя вебхук не пришёл', async () => {
    const getPaymentStatus = jest.fn().mockResolvedValue({ Success: true, Status: 'CONFIRMED' });
    const { service, transactionUpdateMany, orderEvents } = buildService({
      pendingTransactions: [
        { id: 10, order_id: 20, partner_transaction_id: 999, user: { id: 30 } },
      ],
      getPaymentStatus,
    });

    const result = await service.checkPendingPayments();

    expect(getPaymentStatus).toHaveBeenCalledWith(999);
    expect(transactionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, status: TransactionStatus.PENDING },
        data: expect.objectContaining({ status: TransactionStatus.SUCCESS }),
      }),
    );
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'payment_confirmed', meta: expect.objectContaining({ source: 'poll' }) }),
    );
    expect(result).toEqual({ checked: 1, confirmed: 1 });
  });

  it('не трогает транзакцию, если статус ещё не CONFIRMED — остаётся PENDING', async () => {
    const getPaymentStatus = jest.fn().mockResolvedValue({ Success: false, Status: 'FORM_SHOWED' });
    const { service, transactionUpdateMany } = buildService({
      pendingTransactions: [{ id: 10, order_id: 20, partner_transaction_id: 999, user: { id: 30 } }],
      getPaymentStatus,
    });

    const result = await service.checkPendingPayments();

    expect(transactionUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, confirmed: 0 });
  });

  it('не подтверждает повторно, если вебхук уже успел обработать транзакцию (гонка)', async () => {
    const getPaymentStatus = jest.fn().mockResolvedValue({ Success: true, Status: 'CONFIRMED' });
    const { service, orderEvents } = buildService({
      pendingTransactions: [{ id: 10, order_id: 20, partner_transaction_id: 999, user: { id: 30 } }],
      getPaymentStatus,
      updateManyResult: { count: 0 },
    });

    const result = await service.checkPendingPayments();

    expect(result).toEqual({ checked: 1, confirmed: 0 });
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'payment_poll_duplicate' }),
    );
  });

  it('падение запроса к Т-Банку по одной транзакции не останавливает проверку остальных', async () => {
    const getPaymentStatus = jest
      .fn()
      .mockRejectedValueOnce(new Error('T-Bank timeout'))
      .mockResolvedValueOnce({ Success: true, Status: 'CONFIRMED' });

    const { service } = buildService({
      pendingTransactions: [
        { id: 10, order_id: 20, partner_transaction_id: 111, user: { id: 30 } },
        { id: 11, order_id: 21, partner_transaction_id: 222, user: { id: 31 } },
      ],
      getPaymentStatus,
    });

    const result = await service.checkPendingPayments();

    expect(getPaymentStatus).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ checked: 2, confirmed: 1 });
  });

  it('повторный тик не запускается, пока предыдущий ещё выполняется', async () => {
    let resolveFirstCall: () => void;
    const getPaymentStatus = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFirstCall = () => resolve({ Success: false, Status: 'FORM_SHOWED' }); }),
    );
    const { service } = buildService({
      pendingTransactions: [{ id: 10, order_id: 20, partner_transaction_id: 999, user: { id: 30 } }],
      getPaymentStatus,
    });

    const firstRun = service.checkPendingPayments();
    const secondRun = service.checkPendingPayments();

    await expect(secondRun).resolves.toEqual({ checked: 0, confirmed: 0 });

    resolveFirstCall!();
    await firstRun;

    expect(getPaymentStatus).toHaveBeenCalledTimes(1);
  });
});
