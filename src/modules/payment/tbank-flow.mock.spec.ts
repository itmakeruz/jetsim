import 'reflect-metadata';
import * as crypto from 'crypto';
import { OrderStatus, TransactionStatus } from '@prisma/client';
import { TBank } from '../../http/tbank.gateway';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CreateSimService } from '../order/create-sim/create-sim.service';
import { OrderService } from '../order/order.service';
import { TelegramBotService } from '../../common/helpers/telegram-bot.service';
import { JobsService } from '../jobs/jobs.service';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('T-Bank and provider flow (mock)', () => {
  it('returns the exact HTTP response required by T-Bank', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            acceptTransactionStatus: jest.fn().mockResolvedValue('OK'),
          },
        },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer())
      .post('/payment/accept-transaction-status')
      .send({ OrderId: '4248', Success: true, Status: 'CONFIRMED' })
      .expect(200)
      .expect('OK');

    expect(response.headers['content-type']).toContain('text/plain');
    await app.close();
  });

  it('returns OK before provider work and exposes HTTP 200 text/plain contract', async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({ id: 4248, user: { id: 2918 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const orderService = {
      create: jest.fn().mockImplementation(async () => wait(100)),
    };
    const service = new PaymentService(
      prisma as any,
      { log: jest.fn(), error: jest.fn() } as any,
      { verifyNotification: jest.fn().mockReturnValue(true) } as any,
      orderService as any,
      { sendPaymentStatus: jest.fn() } as any,
      { confirmUsageByTransaction: jest.fn(), cancelUsageByTransaction: jest.fn() } as any,
    );

    const startedAt = Date.now();
    await expect(
      service.acceptTransactionStatus({
        OrderId: '4248',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: 8833175602,
      } as any),
    ).resolves.toBe('OK');

    expect(Date.now() - startedAt).toBeLessThan(50);
    expect(Reflect.getMetadata('__httpCode__', PaymentController.prototype.acceptTransactionStatus)).toBe(200);
    expect(Reflect.getMetadata('__headers__', PaymentController.prototype.acceptTransactionStatus)).toEqual([
      { name: 'Content-Type', value: 'text/plain' },
    ]);
  });

  it('accepts a correctly signed notification and rejects forged or unsigned ones', () => {
    const password = 'test-password';
    const gateway = Object.create(TBank.prototype) as TBank;
    Object.assign(gateway as any, { PASSWORD: password });

    const notification = {
      TerminalKey: 'TinkoffBankTest',
      OrderId: '4248',
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: 8833175602,
      Amount: 19200,
    };

    const signed: Record<string, any> = { ...notification, Password: password };
    const expectedToken = crypto
      .createHash('sha256')
      .update(
        Object.keys(signed)
          .sort()
          .map((key) => String(signed[key]))
          .join(''),
      )
      .digest('hex');

    expect(gateway.verifyNotification({ ...notification, Token: expectedToken })).toBe(true);
    expect(gateway.verifyNotification({ ...notification, Token: 'a'.repeat(64) })).toBe(false);
    expect(gateway.verifyNotification({ ...notification })).toBe(false);
    expect(gateway.verifyNotification({ ...notification, Amount: 1, Token: expectedToken })).toBe(false);
  });

  it('logs a signature mismatch but still processes while TBANK_VERIFY_WEBHOOK is off', async () => {
    // Флаг выключен по умолчанию: сначала копим статистику на живом трафике,
    // чтобы включение отклонения не остановило платежи молча
    const prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({ id: 4248, user: { id: 2918 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const service = new PaymentService(
      prisma as any,
      logger as any,
      { verifyNotification: jest.fn().mockReturnValue(false) } as any,
      { create: jest.fn() } as any,
      { sendPaymentStatus: jest.fn() } as any,
      { confirmUsageByTransaction: jest.fn(), cancelUsageByTransaction: jest.fn() } as any,
    );

    await expect(
      service.acceptTransactionStatus({
        OrderId: '4248',
        Success: true,
        Status: 'CONFIRMED',
        PaymentId: 8833175602,
        Token: 'forged',
      } as any),
    ).resolves.toBe('OK');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('SIGNATURE MISMATCH'));
    expect(prisma.transaction.findUnique).toHaveBeenCalled();
  });

  it('stores a provider timeout, marks SIM failed and sends its real message', async () => {
    const prisma = {
      sims: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({
          id: 3319,
          order_id: 3641,
          user: { name: 'Client', email: 'client@example.com' },
        }),
      },
    };
    const telegram = { notifyOrderError: jest.fn() };
    const service = new CreateSimService(
      prisma as any,
      { submitEsimOrder: jest.fn().mockRejectedValue(new Error('provider timeout')) } as any,
      { log: jest.fn(), error: jest.fn() } as any,
      {} as any,
      telegram as any,
    );

    await expect(
      service.processJoyTel(3641, 2918, {
        id: 3319,
        tariff: { sku_id: 'SKU' },
      }),
    ).resolves.toBe(false);

    expect(prisma.sims.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.FAILED,
          response: expect.objectContaining({ message: 'provider timeout' }),
        }),
      }),
    );
    expect(telegram.notifyOrderError).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 3641,
        esimId: 3319,
        response: expect.objectContaining({ message: 'provider timeout' }),
      }),
    );
  });

  it('rejects an inconsistent BillionConnect success response', async () => {
    const prisma = {
      sims: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({
          id: 3319,
          order_id: 3641,
          user: { name: 'Client', email: 'client@example.com' },
        }),
      },
    };
    const service = new CreateSimService(
      prisma as any,
      {} as any,
      { log: jest.fn(), error: jest.fn() } as any,
      {
        createEsimOrder: jest.fn().mockResolvedValue({
          tradeCode: '1000',
          tradeMsg: 'invalid success flag',
          tradeData: { successFlag: 'false' },
        }),
      } as any,
      { notifyOrderError: jest.fn() } as any,
    );

    await expect(
      service.processBillion(3641, 2918, {
        id: 3319,
        user: { email: 'client@example.com' },
        tariff: { sku_id: 'SKU', validity_period: 30 },
      }),
    ).resolves.toBe(false);
  });

  it('uses an atomic SIM claim to prevent duplicate provider requests', async () => {
    const provider = { createEsimOrder: jest.fn() };
    const service = new CreateSimService(
      { sims: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } } as any,
      {} as any,
      { log: jest.fn(), error: jest.fn() } as any,
      provider as any,
      { notifyOrderError: jest.fn() } as any,
    );

    await expect(
      service.processBillion(3641, 2918, {
        id: 3319,
        user: { email: 'client@example.com' },
        tariff: { sku_id: 'SKU', validity_period: 30 },
      }),
    ).resolves.toBe(true);
    expect(provider.createEsimOrder).not.toHaveBeenCalled();
  });

  it('marks the order failed and notifies the client socket when a SIM fails', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 3641,
          user: { id: 2918, email: 'client@example.com' },
          sims: [{ id: 3319, partner_id: 2, tariff_id: 1, tariff: { sku_id: 'SKU', validity_period: 30 } }],
        }),
        update: jest.fn(),
      },
      basketItem: { deleteMany: jest.fn() },
    };
    const socket = { sendErrorOrderMessage: jest.fn() };
    const service = new OrderService(
      prisma as any,
      {} as any,
      {} as any,
      socket as any,
      {} as any,
      { log: jest.fn(), info: jest.fn() } as any,
      {} as any,
      { processBillion: jest.fn().mockResolvedValue(false), processJoyTel: jest.fn() } as any,
    );

    await expect(service.create(2918, 4248)).resolves.toEqual(expect.objectContaining({ success: false }));
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: OrderStatus.FAILED } }));
    expect(socket.sendErrorOrderMessage).toHaveBeenCalledWith(2918, 3641);
  });

  it('sends provider errors to the same Telegram chat as success messages', async () => {
    const bot = {
      sendMessage: jest.fn(),
      sendPhoto: jest.fn(),
    };
    const telegram = Object.create(TelegramBotService.prototype) as TelegramBotService;
    Object.assign(telegram as any, {
      bot,
      logger: { log: jest.fn(), error: jest.fn() },
      notificationChatId: '-5179566420',
    });

    await telegram.notifyOrderError({
      partnerId: 2,
      orderId: 3641,
      esimId: 3319,
      date: new Date().toISOString(),
      client: { name: 'Client', email: 'client@example.com' },
      errorCode: '500',
      response: { message: 'provider timeout' },
    });
    await telegram.notifySimActivated({
      orderId: 3641,
      esimId: 3319,
      date: new Date().toISOString(),
      client: { name: 'Client', email: 'client@example.com' },
      sim: { cid: 'cid', snPin: 'pin', snCode: 'code', status: 'COMPLETED' },
      qrBuffer: Buffer.from('qr'),
    });

    expect(bot.sendMessage.mock.calls[0][0]).toBe('-5179566420');
    expect(bot.sendPhoto.mock.calls[0][0]).toBe('-5179566420');
  });

  it('recovers a confirmed payment left with CREATED SIMs', async () => {
    const orderService = { create: jest.fn() };
    const jobs = new JobsService(
      { log: jest.fn(), error: jest.fn() } as any,
      {
        transaction: {
          findMany: jest.fn().mockResolvedValue([{ id: 4248, user_id: 2918 }]),
        },
      } as any,
      {} as any,
      {} as any,
      orderService as any,
      { cancelUsageByTransaction: jest.fn() } as any,
    );

    await jobs.processPendingConfirmedPayments();
    expect(orderService.create).toHaveBeenCalledWith(2918, 4248);
  });

  it('never cancels a stale order whose payment arrived before the update', async () => {
    const tx = {
      transaction: { count: jest.fn().mockResolvedValue(1), updateMany: jest.fn() },
      order: { updateMany: jest.fn() },
      sims: { updateMany: jest.fn() },
    };
    const promoCodeService = { cancelUsageByTransaction: jest.fn() };
    const jobs = new JobsService(
      { log: jest.fn(), error: jest.fn() } as any,
      {
        order: {
          findMany: jest.fn().mockResolvedValue([{ id: 3641, transactions: [{ id: 4248 }] }]),
        },
        $transaction: jest.fn(async (cb: any) => cb(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      promoCodeService as any,
    );

    await jobs.cancelStaleOrders();

    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.sims.updateMany).not.toHaveBeenCalled();
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
    expect(promoCodeService.cancelUsageByTransaction).not.toHaveBeenCalled();
  });

  it('cancels an abandoned order and releases its promo code', async () => {
    const tx = {
      transaction: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sims: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const promoCodeService = { cancelUsageByTransaction: jest.fn() };
    const jobs = new JobsService(
      { log: jest.fn(), error: jest.fn() } as any,
      {
        order: {
          findMany: jest.fn().mockResolvedValue([{ id: 3641, transactions: [{ id: 4248 }] }]),
        },
        $transaction: jest.fn(async (cb: any) => cb(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      promoCodeService as any,
    );

    await jobs.cancelStaleOrders();

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: OrderStatus.FAILED } }),
    );
    expect(tx.sims.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: OrderStatus.FAILED } }));
    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: TransactionStatus.CANCELED } }),
    );
    expect(promoCodeService.cancelUsageByTransaction).toHaveBeenCalledWith(4248);
  });
});
