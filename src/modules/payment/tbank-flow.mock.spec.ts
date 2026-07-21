import 'reflect-metadata';
import { OrderStatus } from '@prisma/client';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CreateSimService } from '../order/create-sim/create-sim.service';
import { OrderService } from '../order/order.service';
import { TelegramBotService } from '../../common/helpers/telegram-bot.service';
import { JobsService } from '../jobs/jobs.service';
import { TBank } from '../../http/tbank.gateway';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('T-Bank and provider flow (mock)', () => {
  it('accepts a valid T-Bank token and rejects a modified payload', () => {
    const gateway = Object.create(TBank.prototype) as any;
    gateway.TBANK_TERMINAL_ID = 'terminal';
    gateway.PASSWORD = 'password';

    const notification: any = {
      TerminalKey: 'terminal',
      OrderId: '4418',
      Success: true,
      Status: 'CONFIRMED',
      PaymentId: 8896653862,
      ErrorCode: '0',
      Amount: 95000,
      CardId: 691996750,
      Pan: '220220******0768',
      ExpDate: '0334',
    };
    notification.Token = gateway.generateToken(notification, gateway.PASSWORD);

    expect(gateway.verifyNotification(notification)).toBe(true);
    expect(gateway.verifyNotification({ ...notification, Amount: 1 })).toBe(false);
  });

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

  it('rejects a forged T-Bank notification before touching payment state', async () => {
    const prisma = {
      transaction: {
        findUnique: jest.fn(),
      },
    };
    const service = new PaymentService(
      prisma as any,
      { log: jest.fn(), error: jest.fn() } as any,
      { verifyNotification: jest.fn().mockReturnValue(false) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.acceptTransactionStatus({
        TerminalKey: 'terminal',
        OrderId: '4248',
        Success: true,
        Status: 'CONFIRMED',
        Token: 'forged',
      } as any),
    ).rejects.toThrow('Invalid T-Bank notification token');

    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
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
    );

    await jobs.processPendingConfirmedPayments();
    expect(orderService.create).toHaveBeenCalledWith(2918, 4248);
  });
});
