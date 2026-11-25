import { ResellersAdminService } from './resellers-admin.service';

function make(total = 45) {
  const row = (id: number) => ({ tariff_id: id, price_kopecks: 12345n, price_version: 2, active: true, created_at: new Date(), updated_at: null, tariff: { name_ru: 'ОАЭ', name_en: 'UAE', quantity_internet: 5, validity_period: 30, status: 'ACTIVE', price_arrival: 100 } });
  const prisma: any = {
    resellerTariff: { count: jest.fn().mockResolvedValue(total), findMany: jest.fn().mockResolvedValue([row(1), row(2)]) },
    tariff: {
      findMany: jest.fn().mockImplementation(({ distinct }: any) =>
        Promise.resolve(distinct[0] === 'quantity_internet' ? [{ quantity_internet: 10 }, { quantity_internet: 3 }, { quantity_internet: 3 }, { quantity_internet: null }] : [{ validity_period: 30 }, { validity_period: 7 }]),
      ),
    },
  };
  const svc: any = new ResellersAdminService(prisma, {} as any);
  svc.requireReseller = jest.fn().mockResolvedValue({ id: 4, currency: 'RUB' });
  return { svc: svc as ResellersAdminService, prisma };
}

describe('ResellersAdminService.searchResellerTariffs', () => {
  it('pages in the database and returns total, pages and facets', async () => {
    const { svc, prisma } = make(45);
    const r = await svc.searchResellerTariffs(4, { page: 2, size: 20 });
    const args = prisma.resellerTariff.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ skip: 20, take: 20, where: { reseller_id: 4 } });
    expect(args.orderBy).toEqual([{ tariff_id: 'asc' }, { tariff_id: 'asc' }]);
    expect(r.meta).toEqual({ page: 2, size: 20, total: 45, pages: 3 });
    expect(r.facets).toEqual({ data_gb: [3, 10], validity_days: [7, 30] });
    expect(r.data[0]).toMatchObject({ tariff_id: 1, price_kopecks: 12345, data_gb: 5, validity_days: 30, currency: 'RUB', cost_kopecks: 10000 });
  });

  it('builds filters: name or id search, traffic, validity, sold flag and price range in minor units', async () => {
    const { svc, prisma } = make();
    await svc.searchResellerTariffs(4, { search: ' 77 ', data_gb: 5, validity_days: 30, active: 'false', min_price_kopecks: 100, max_price_kopecks: 5000 });
    const where = prisma.resellerTariff.findMany.mock.calls[0][0].where;
    expect(where.active).toBe(false);
    expect(where.price_kopecks).toEqual({ gte: 100n, lte: 5000n });
    expect(where.tariff).toMatchObject({ quantity_internet: 5, validity_period: 30 });
    expect(where.tariff.OR).toEqual(expect.arrayContaining([{ id: 77 }, { name_ru: { contains: '77', mode: 'insensitive' } }]));
  });

  it('sorts by the requested column with a stable tie-breaker', async () => {
    const { svc, prisma } = make();
    await svc.searchResellerTariffs(4, { sort: 'price', order: 'desc' });
    expect(prisma.resellerTariff.findMany.mock.calls[0][0].orderBy).toEqual([{ price_kopecks: 'desc' }, { tariff_id: 'asc' }]);
    await svc.searchResellerTariffs(4, { sort: 'data_gb', order: 'asc' });
    expect(prisma.resellerTariff.findMany.mock.calls[1][0].orderBy[0]).toEqual({ tariff: { quantity_internet: 'asc' } });
  });

  it('does not treat a non-numeric search as an id', async () => {
    const { svc, prisma } = make();
    await svc.searchResellerTariffs(4, { search: 'oae' });
    expect(prisma.resellerTariff.findMany.mock.calls[0][0].where.tariff.OR).toHaveLength(2);
  });
});
