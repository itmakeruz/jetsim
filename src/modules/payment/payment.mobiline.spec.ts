import { PaymentService } from './payment.service';
import { OrderService } from '../order/order.service';

function setup(providerType = 3) {
  const prisma = {
    basket: {
      findFirst: jest.fn().mockResolvedValue({
        id: 1,
        user: { id: 5, email: 'client@test.invalid' },
        items: [
          {
            tariff_id: 11,
            quantity: 2,
            price: 10000,
            tariff: { id: 11, name_ru: 'Japan', partner_id: 30, status: 'ACTIVE', price_sell: 10000 },
          },
        ],
      }),
    },
    partner: { findMany: jest.fn().mockResolvedValue([{ id: 30, identified_number: providerType }]) },
    transaction: { create: jest.fn().mockResolvedValue({ id: 8 }), update: jest.fn() },
    order: { create: jest.fn().mockResolvedValue({ id: 9 }) },
    sims: { create: jest.fn() },
  };
  const promo = { validateCodeForPayment: jest.fn().mockResolvedValue(null), createPendingUsage: jest.fn() };
  const service = new PaymentService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    promo as any,
    { record: jest.fn() } as any,
  );
  return { service, prisma };
}
describe('Mobiline payment preparation and routing', () => {
  it('creates one SIM per unit using the actual partner FK', async () => {
    const { service, prisma } = setup();
    await service.getPaymentInfos(5, 'ru');
    expect(prisma.sims.create).toHaveBeenCalledTimes(2);
    expect(prisma.sims.create).toHaveBeenCalledWith({
      data: { user_id: 5, order_id: 9, partner_id: 30, tariff_id: 11, status: 'CREATED' },
    });
  });
  it('rejects unsupported providers before creating payment records', async () => {
    const { service, prisma } = setup(99);
    await expect(service.getPaymentInfos(5, 'ru')).rejects.toMatchObject({ status: 400 });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
  it('routes paid SIMs by provider type rather than their row ID', async () => {
    const mobiline = { submit: jest.fn().mockResolvedValue(true) };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9,
          user: { id: 5, email: 'client@test.invalid' },
          sims: [
            {
              id: 1,
              tariff_id: 11,
              partner_id: 30,
              partner: { identified_number: 3 },
              tariff: { sku_id: 'SKU', validity_period: 10 },
            },
            {
              id: 2,
              tariff_id: 11,
              partner_id: 30,
              partner: { identified_number: 3 },
              tariff: { sku_id: 'SKU', validity_period: 10 },
            },
          ],
        }),
        update: jest.fn(),
      },
      basketItem: { deleteMany: jest.fn() },
    };
    const service = new OrderService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { info: jest.fn(), log: jest.fn() } as any,
      {} as any,
      { processBillion: jest.fn(), processJoyTel: jest.fn() } as any,
      { record: jest.fn() } as any,
      mobiline as any,
    );
    await expect(service.create(5, 8)).resolves.toMatchObject({ success: true });
    expect(mobiline.submit).toHaveBeenCalledTimes(2);
    expect(mobiline.submit).toHaveBeenCalledWith(9, expect.objectContaining({ id: 2, partner_id: 30 }));
  });
});
