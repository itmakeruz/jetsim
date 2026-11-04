import './testing/env';
import { JobsService } from '../jobs/jobs.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { OrderService } from '../order/order.service';
import { SimsService } from '../sims/sims.service';
import { UsersService } from '../users/users.service';
import { createTestPrisma, describeDb, resetB2bTables, seedPartner, seedReseller, seedResellerOrder, seedTariff } from './testing/db';

/**
 * B2B-выпуск использует обычные строки Sims/Order/User центрального JetSim, поэтому розничные
 * выборки и, главное, крон отмены брошенных заказов обязаны их не видеть.
 */
describeDb('Изоляция розницы от B2B (реальный Postgres)', () => {
  const prisma = createTestPrisma();
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  let retail: { orderId: number; simId: number; userId: number };
  let b2b: { orderId: number; simId: number; userId: number; resellerOrderId: number };

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  beforeEach(async () => {
    await resetB2bTables(prisma);
    const partner = await seedPartner(prisma, 1);
    const tariff = await seedTariff(prisma, partner.id, { price_sell: 500 });

    const user = await prisma.user.create({ data: { name: 'Клиент розницы', email: 'c@example.com' } });
    const rOrder = await prisma.order.create({ data: { status: 'CREATED', user_id: user.id, created_at: daysAgo(3) } });
    const rSim = await prisma.sims.create({
      data: { status: 'CREATED', partner_id: partner.id, user_id: user.id, tariff_id: tariff.id, order_id: rOrder.id },
    });
    retail = { orderId: rOrder.id, simId: rSim.id, userId: user.id };

    const reseller = await seedReseller(prisma, 'Yatumo', 100_000n);
    const ro = await seedResellerOrder(prisma, { resellerId: reseller.id, tariffId: tariff.id, clientOrderId: 'o-1', price: 10_000n, state: 'RECONCILE' });
    const bOrder = await prisma.order.create({
      data: { status: 'CREATED', user_id: reseller.service_user_id, reseller_order_id: ro.id, created_at: daysAgo(3) },
    });
    const bSim = await prisma.sims.create({
      data: { status: 'PENDING', partner_id: partner.id, user_id: reseller.service_user_id, tariff_id: tariff.id, order_id: bOrder.id, reseller_order_id: ro.id },
    });
    b2b = { orderId: bOrder.id, simId: bSim.id, userId: reseller.service_user_id, resellerOrderId: ro.id };
  });

  it('КРОН ОТМЕНЫ: брошенный розничный заказ отменяется, B2B-«оболочка» и её SIM остаются нетронутыми', async () => {
    const promo = { cancelUsageByTransaction: jest.fn() };
    const jobs = new JobsService({ log: jest.fn(), error: jest.fn() } as any, prisma, {} as any, {} as any, {} as any, promo as any, {} as any);

    await jobs.cancelStaleOrders();

    expect((await prisma.order.findUniqueOrThrow({ where: { id: retail.orderId } })).status).toBe('FAILED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b2b.orderId } })).status).toBe('CREATED');
    expect((await prisma.sims.findUniqueOrThrow({ where: { id: b2b.simId } })).status).toBe('PENDING');
  });

  it('список пользователей в CRM не содержит служебных пользователей компаний', async () => {
    const res: any = await new UsersService(prisma).findAll({} as any);
    const ids = res.data.map((u: any) => u.id);
    expect(ids).toContain(retail.userId);
    expect(ids).not.toContain(b2b.userId);
  });

  it('список SIM в CRM не содержит B2B-SIM', async () => {
    const sims = new SimsService(prisma, {} as any, {} as any, { log: jest.fn(), error: jest.fn() } as any, {} as any, {} as any);
    const res: any = await sims.findAll({} as any);
    const ids = res.data.map((s: any) => s.id);
    expect(ids).toContain(retail.simId);
    expect(ids).not.toContain(b2b.simId);
  });

  it('список заказов в CRM не содержит B2B-«оболочек»', async () => {
    const svc: any = Object.create(OrderService.prototype);
    svc.prisma = prisma;
    const res: any = await svc.findAll({});
    const ids = res.data.map((o: any) => o.id);
    expect(ids).toContain(retail.orderId);
    expect(ids).not.toContain(b2b.orderId);
  });

  it('дашборд считает только розницу: заказы, выручка, клиенты', async () => {
    const res = await new DashboardService(prisma).get({} as any);
    expect(res.data.total_orders).toBe(1);
    expect(res.data.new_clients).toBe(1);
    expect((res.data.daily_sales as any[]).reduce((s: number, d: any) => s + d.total, 0)).toBe(500);
    expect((res.data.top_tariffs as any[]).reduce((s: number, t: any) => s + t.sold, 0)).toBe(1);
  });
});
