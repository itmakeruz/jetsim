import { ResellersAdminService } from './resellers-admin.service';

function make(existing: any[] = [], attached: any[] = []) {
  const tx = {
    regionGroup: { findUniqueOrThrow: jest.fn().mockResolvedValue({ regions: [{ id: 5 }, { id: 6 }] }) },
    tariff: { create: jest.fn().mockResolvedValue({ id: 901 }) },
    resellerTariff: { create: jest.fn() },
  };
  const prisma: any = {
    reseller: { findUnique: jest.fn().mockResolvedValue({ id: 4, currency: 'RUB' }) },
    partner: { findMany: jest.fn().mockResolvedValue([{ id: 1, name_ru: 'Джойтел', name_en: 'Joytel' }]) },
    regionGroup: { findMany: jest.fn().mockResolvedValue([{ id: 10, name_ru: 'Япония', name_en: 'Japan', _count: { regions: 2 } }]) },
    tariff: { findMany: jest.fn().mockResolvedValue(existing) },
    resellerTariff: { findMany: jest.fn().mockResolvedValue(attached) },
    $transaction: jest.fn((fn: any) => fn(tx)),
  };
  const svc: any = new ResellersAdminService(prisma, {} as any);
  svc.requireReseller = jest.fn().mockResolvedValue({ id: 4, currency: 'RUB' });
  return { svc: svc as ResellersAdminService, prisma, tx };
}
const item = (over: any = {}) => ({ sku_id: 'JP-1', partner: 'Joytel', name_ru: 'Япония', name_en: 'Japan', data_gb: 5, validity_days: 30, region_group: 'Япония', cost_rub: 300, company_price: 450, ...over });

describe('ResellersAdminService.importTariffs', () => {
  it('dry run only plans: nothing is written', async () => {
    const { svc, prisma } = make();
    const r = await svc.importTariffs(4, { dry_run: true, items: [item()] } as any);
    expect(r).toMatchObject({ applied: false, summary: { create: 1, error: 0 } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates hidden active tariffs with the group countries and attaches them with the company price', async () => {
    const { svc, tx } = make();
    const r = await svc.importTariffs(4, { dry_run: false, items: [item()] } as any);
    expect(r.applied).toBe(true);
    const data = tx.tariff.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ hide_site: true, status: 'ACTIVE', sku_id: 'JP-1', price_arrival: 30000, quantity_internet: 5, is_regional: true });
    expect(data.regions.connect).toEqual([{ id: 5 }, { id: 6 }]);
    expect(tx.resellerTariff.create.mock.calls[0][0].data).toMatchObject({ reseller_id: 4, tariff_id: 901, price_kopecks: 45000n, active: true });
    expect(r.rows[0]).toMatchObject({ verdict: 'CREATE', tariff_id: 901 });
  });

  it('writes nothing when any row has an error (all or nothing)', async () => {
    const { svc, prisma, tx } = make();
    const r = await svc.importTariffs(4, { dry_run: false, items: [item(), item({ sku_id: 'X', partner: 'Nope' })] } as any);
    expect(r).toMatchObject({ applied: false, summary: { create: 1, error: 1 } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.tariff.create).not.toHaveBeenCalled();
  });

  it('attaches an existing tariff without touching it and skips an already attached one', async () => {
    const { svc, tx } = make([{ id: 55, sku_id: 'JP-1', partner_id: 1, quantity_internet: 5, validity_period: 30 }]);
    const r = await svc.importTariffs(4, { dry_run: false, items: [item()] } as any);
    expect(tx.tariff.create).not.toHaveBeenCalled();
    expect(tx.resellerTariff.create).toHaveBeenCalledTimes(1);
    expect(r.rows[0]).toMatchObject({ verdict: 'ATTACH', tariff_id: 55 });
    const again = make([{ id: 55, sku_id: 'JP-1', partner_id: 1, quantity_internet: 5, validity_period: 30 }], [{ tariff_id: 55 }]);
    const r2 = await again.svc.importTariffs(4, { dry_run: false, items: [item()] } as any);
    expect(r2.rows[0].verdict).toBe('SKIP');
    expect(again.tx.resellerTariff.create).not.toHaveBeenCalled();
  });
});

it('loads supplier routing codes and uses Joytel record ID for aliases', async () => {
  const {svc, prisma, tx} = make();
  prisma.partner.findMany.mockResolvedValue([{id:42,name_ru:'Поставщик',name_en:'Provider',identified_number:1}]);
  const result = await svc.importTariffs(4,{dry_run:false,items:[item({partner:'JT'})]} as any);
  expect(result.applied).toBe(true);
  expect(prisma.partner.findMany.mock.calls[0][0].select.identified_number).toBe(true);
  expect(tx.tariff.create.mock.calls[0][0].data.partner_id).toBe(42);
});
