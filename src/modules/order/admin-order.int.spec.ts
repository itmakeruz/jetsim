import '../b2b/testing/env';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createTestPrisma, describeDb, resetB2bTables, seedPartner, seedReseller, seedTariff } from '../b2b/testing/db';
import { AdminOrderService } from './admin-order.service';
import { ManualPaymentMethod } from './dto';

describeDb('Заказ из админки (реальный Postgres)', () => {
  const prisma = createTestPrisma();
  const staff = { id: 7, role: 'ADMIN' };
  let tariffId: number;
  let createSpy: jest.Mock;
  let service: AdminOrderService;

  const dto = (over: Record<string, unknown> = {}) =>
    ({ tariff_id: tariffId, client_email: 'Client@Example.com', payment_method: ManualPaymentMethod.CASH, ...over }) as any;

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    await resetB2bTables(prisma);
    const partner = await seedPartner(prisma, 1);
    tariffId = (await seedTariff(prisma, partner.id, { price_sell: 150_00 })).id;
    // Выдачу подменяем: она ходит к поставщикам; здесь важно, что заказ подготовлен и выдача запущена ровно один раз
    createSpy = jest.fn(async (_userId: number, transactionId: number) => {
      await prisma.order.updateMany({ where: { transaction_id: transactionId }, data: { status: 'COMPLETED' } });
    });
    service = new AdminOrderService(prisma, { create: createSpy } as any, { record: (p: any) => prisma.orderEvent.create({ data: { order_id: p.orderId, event: p.event, severity: p.severity ?? 'info', message: p.message ?? null, meta: p.meta ?? undefined } as any }) } as any);
  });

  it('создаёт клиента, оплаченную вручную транзакцию, заказ и N SIM и запускает выдачу один раз', async () => {
    const res = await service.create(dto({ quantity: 2, client_name: 'Иван', comment: 'оплатил в офисе' }), staff);
    expect(res.success).toBe(true);
    expect(res.data.sims).toHaveLength(2);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.data.order_id }, include: { sims: true, transactions: true, user: true, events: true } });
    expect(order.user).toMatchObject({ email: 'client@example.com', name: 'Иван', is_verified: true });
    expect(order.sims.every((s) => s.tariff_id === tariffId)).toBe(true);
    expect(order.transactions[0]).toMatchObject({ status: 'SUCCESS', amount: String(300_00) });
    expect(order.transactions[0].request).toMatchObject({ manual: true, payment_method: 'CASH', created_by: { staff_id: 7 } });
    expect(order.events.map((e) => e.event)).toEqual(expect.arrayContaining(['manual_order_created', 'payment_manual_confirmed']));
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('повтор и параллельные запросы с тем же request_id дают один заказ и одну выдачу', async () => {
    const request_id = randomUUID();
    const results = await Promise.all(Array.from({ length: 6 }, () => service.create(dto({ request_id }), staff)));
    expect(new Set(results.map((r) => r.data.order_id)).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.sims.count()).toBe(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.data.repeated)).toHaveLength(5);
  });

  it('клиента ищет по email без учёта регистра; служебного пользователя B2B с таким email не берёт', async () => {
    const reseller = await seedReseller(prisma, 'Yatumo');
    await prisma.user.update({ where: { id: reseller.service_user_id }, data: { email: 'client@example.com' } });
    const existing = await prisma.user.create({ data: { email: 'CLIENT@example.com', is_verified: true } });
    const a = await service.create(dto({ client_name: 'Имя' }), staff);
    expect(a.data.client.id).toBe(existing.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe('Имя');

    // Без обычного клиента с таким email заказ получает нового клиента, а не служебного пользователя компании
    await resetB2bTables(prisma);
    const partner = await seedPartner(prisma, 1);
    tariffId = (await seedTariff(prisma, partner.id, { price_sell: 150_00 })).id;
    const other = await seedReseller(prisma, 'Yatumo 2');
    await prisma.user.update({ where: { id: other.service_user_id }, data: { email: 'client@example.com' } });
    const b = await service.create(dto(), staff);
    expect(b.data.client.id).not.toBe(other.service_user_id);
    expect(await prisma.user.count({ where: { email: 'client@example.com', is_service: false } })).toBe(1);
  });

  it('недоступный тариф и несуществующий — отказ без побочных записей', async () => {
    await prisma.tariff.update({ where: { id: tariffId }, data: { status: 'INACTIVE' } as any });
    await expect(service.create(dto(), staff)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(dto({ tariff_id: 99999 }), staff)).rejects.toThrow('Тариф не найден');
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
