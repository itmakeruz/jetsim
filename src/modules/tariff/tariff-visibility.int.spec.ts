import { TariffService } from './tariff.service';
import { RegionService } from '../region/region.service';
import { RegionGroupService } from '../region_group/region_group.service';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import { B2bCatalogService } from '../b2b/purchase/b2b-catalog.service';
import { createB2bTestApp } from '../b2b/testing/app';
import { createTestPrisma, describeDb, resetB2bTables, seedPartner, seedReseller, seedTariff } from '../b2b/testing/db';
import { prisma as paginationPrisma } from '../../common/helpers/prisma-helper';
import { B2bOrdersService } from '../b2b/purchase/b2b-orders.service';

describeDb('Website tariff visibility, real Postgres, fake providers', () => {
  const db = createTestPrisma();
  const tariffs = new TariffService(db);
  const regions = new RegionService(db);
  const groups = new RegionGroupService(db);
  let regionId: number, groupId: number, visibleId: number, hiddenId: number;
  beforeEach(async () => {
    await resetB2bTables(db);
    await db.regionGroup.deleteMany();
    await db.region.deleteMany();
    regionId = (await db.region.create({ data: { name_ru: 'Япония', name_en: 'Japan', status: 'ACTIVE' } })).id;
    groupId = (await db.regionGroup.create({ data: { name_ru: 'Япония', name_en: 'Japan', regions: { connect: { id: regionId } } } })).id;
    const provider = await seedPartner(db);
    const common = { region_group_id: groupId, is_local: true, regions: { connect: { id: regionId } } };
    visibleId = (await seedTariff(db, provider.id, { ...common, price_sell: 10000 })).id;
    hiddenId = (await seedTariff(db, provider.id, { ...common, price_sell: 100, hide_site: true })).id;
  });
  afterAll(async () => { await db.$disconnect(); await paginationPrisma.$disconnect(); });

  it('defaults to visible, excludes hidden tariffs even with crafted filters; admin retains both', async () => {
    expect((await db.tariff.findUniqueOrThrow({ where: { id: visibleId } })).hide_site).toBe(false);
    expect((await tariffs.findAll({ filters: [{ column: 'hide_site', operator: 'equals', value: true }] } as any, 'ru')).data.map(t => t.id)).toEqual([visibleId]);
    await expect(tariffs.findOne(hiddenId, 'ru')).rejects.toMatchObject({ status: 404 });
    expect((await tariffs.findAllAdmin({} as any)).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: hiddenId, hide_site: true })]));
    expect((await tariffs.findOneAdmin(hiddenId)).data.hide_site).toBe(true);
  });

  it('excludes hidden offers from both plan APIs and minimum prices; hides destinations with no visible offers', async () => {
    expect((await regions.findAll({} as any, 'ru')).data[0].min_price).toBe(100);
    expect((await groups.findRegionGroups({}, 'ru')).data[0].min_price).toBe(100);
    expect((await regions.getRegionPlansByIds(String(regionId), 'ru')).data.tariffs.local.map(t => t.id)).toEqual([visibleId]);
    expect((await groups.getPlansUniversal(groupId, null, 'ru')).data.tariffs.local.map(t => t.id)).toEqual([visibleId]);
    await tariffs.update(visibleId, { hide_site: true } as any);
    expect((await regions.findAll({} as any, 'ru')).data).toEqual([]);
    expect((await groups.findRegionGroups({}, 'ru')).data).toEqual([]);
  });

  it('toggle-only update preserves price, status and coverage; omitted flag is preserved and false restores visibility', async () => {
    await tariffs.update(hiddenId, { name_ru: 'Новое имя' } as any);
    let row = await db.tariff.findUniqueOrThrow({ where: { id: hiddenId }, include: { regions: true } });
    expect(row).toMatchObject({ hide_site: true, status: 'ACTIVE', price_sell: 100 });
    expect(row.regions.map(r => r.id)).toEqual([regionId]);
    await tariffs.update(hiddenId, { hide_site: false } as any);
    expect((await tariffs.findOne(hiddenId, 'ru')).data.id).toBe(hiddenId);
  });

  it('B2B still lists and reserves a hidden tariff at its assigned company price', async () => {
    const reseller = await seedReseller(db, 'Partner', 10000n);
    await db.resellerTariff.create({ data: { reseller_id: reseller.id, tariff_id: hiddenId, price_kopecks: 1000n } });
    expect((await new B2bCatalogService(db).list(reseller.id)).map(t => t.id)).toContain(hiddenId);
    const h = await createB2bTestApp(db);
    try {
      const result = await h.app.get(B2bOrdersService).create(reseller.id, { tariff_id: hiddenId, price_version: 1, client_order_id: 'hidden-b2b' });
      expect(result.created).toBe(true);
      expect(result.order.price_kopecks).toBe(1000n);
    } finally { await h.app.close(); }
  });

  it('rejects hidden IDs in both retail basket entry points and a basket saved before hiding, before creating payments', async () => {
    const user = await db.user.create({ data: { email: 'visibility@test.invalid' } });
    const order = new OrderService(db, ...Array(9).fill(undefined) as [any, any, any, any, any, any, any, any, any]);
    await expect(order.addToBasket({ tariff_id: hiddenId, quantity: 1 } as any, user.id, 'ru')).rejects.toMatchObject({ status: 404 });
    await expect(order.addItemsToBasket([{ tariff_id: hiddenId, quantity: 1 } as any], user.id, 'ru')).rejects.toMatchObject({ status: 404 });
    const basket = await db.basket.findFirstOrThrow({ where: { user_id: user.id } });
    await db.basketItem.create({ data: { basket_id: basket.id, tariff_id: hiddenId, quantity: 1, price: 100 } });
    const payment = new PaymentService(db, undefined, undefined, undefined, undefined, undefined, undefined);
    await expect(payment.getPaymentInfos(user.id, 'ru')).rejects.toMatchObject({ status: 400 });
    expect(await db.transaction.count()).toBe(0);
    expect(await db.sims.count()).toBe(0);
  });
});
