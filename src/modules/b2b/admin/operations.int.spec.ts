import '../testing/env';
import * as request from 'supertest';
import { createTestPrisma, describeDb, resetB2bTables, seedPartner, seedTariff, seedReseller } from '../testing/db';
import { createB2bTestApp, MGMT_KEY } from '../testing/app';

describeDb('Platform operations', () => {
  const db = createTestPrisma();
  let h: Awaited<ReturnType<typeof createB2bTestApp>>;
  let reseller: number, tariff: number;
  const admin = (method: 'get' | 'post', path: string) => request(h.app.getHttpServer())[method](`/b2b-admin/operations${path}`).set('X-Management-Key', MGMT_KEY);
  beforeAll(async () => { h = await createB2bTestApp(db); });
  afterAll(async () => { await h.app.close(); await db.$disconnect(); });
  beforeEach(async () => {
    await resetB2bTables(db);
    const partner = await seedPartner(db);
    tariff = (await seedTariff(db, partner.id, { price_arrival: 5 })).id;
    reseller = (await seedReseller(db, 'Test', 10000n)).id;
    await db.resellerTariff.create({ data: { reseller_id: reseller, tariff_id: tariff, price_kopecks: 1000n, price_version: 1 } });
  });
  it('restricts platform operations to the management key', async () => {
    await request(h.app.getHttpServer()).get('/b2b-admin/operations/overview').expect(401);
  });
  it('applies prices atomically and rejects stale versions', async () => {
    await admin('post', `/resellers/${reseller}/prices`).send({ items: [{ tariff_id: tariff, price_version: 1, price_kopecks: 2000 }, { tariff_id: 999, price_version: 1, price_kopecks: 1 }] }).expect(409);
    expect((await db.resellerTariff.findFirstOrThrow()).price_kopecks).toBe(1000n);
    await admin('post', `/resellers/${reseller}/prices`).send({ items: [{ tariff_id: tariff, price_version: 1, price_kopecks: 2000 }] }).expect(201);
    await admin('post', `/resellers/${reseller}/prices`).send({ items: [{ tariff_id: tariff, price_version: 1, price_kopecks: 3000 }] }).expect(409);
    expect((await db.resellerTariff.findFirstOrThrow()).price_version).toBe(2);
  });
  it('returns unknown historical margin instead of zero cost', async () => {
    await db.resellerOrder.create({ data: { reseller_id: reseller, client_order_id: 'old', request_hash: 'old', tariff_id: tariff, tariff_name_ru: 'Test', tariff_name_en: 'Test', price_kopecks: 1000n, price_version: 1, state: 'ISSUED' } });
    const response = await admin('get', '/overview').expect(200);
    expect(response.body.rows[0]).toMatchObject({ count: 1, sales_kopecks: 1000, margin_kopecks: null, cost_kopecks: null });
  });
  it('reports provider latency and failure frequency from actual orders', async () => {
    for (const state of ['ISSUED', 'FAILED'] as const) await db.resellerOrder.create({ data: { reseller_id: reseller, client_order_id: state, request_hash: state, tariff_id: tariff, tariff_name_ru: 'Test', tariff_name_en: 'Test', price_kopecks: 1000n, price_version: 1, state, provider_name: 'P1', submitted_at: new Date(Date.now() - 20000), issued_at: state === 'ISSUED' ? new Date() : null } });
    const response = await admin('get', '/providers').expect(200);
    expect(response.body.rows).toHaveLength(2);
    expect(response.body.rows[0]).toMatchObject({ provider: 'P1', failure_rate_percent: 50, balance: null });
    expect(response.body.rows[0].avg_issue_seconds).toBeGreaterThanOrEqual(19);
    expect(response.body.observations).toHaveLength(3);
  });
  it('snapshots cost on purchase and does not expose it through purchase API', async () => {
    const key = (await request(h.app.getHttpServer()).post(`/b2b-admin/resellers/${reseller}/keys`).set('X-Management-Key', MGMT_KEY).send({ name: 'Test' }).expect(201)).body.key;
    const result = await request(h.app.getHttpServer()).post('/b2b/orders').set('X-Reseller-Key', key).send({ client_order_id: 'new', tariff_id: tariff, price_version: 1 }).expect(202);
    expect(result.body).not.toHaveProperty('cost_kopecks');
    expect(await db.resellerOrder.findFirstOrThrow()).toMatchObject({ cost_kopecks: 500n, cost_currency: 'RUB', provider_name: 'P1' });
    await db.tariff.update({ where: { id: tariff }, data: { price_arrival: 7 } });
    expect((await db.resellerOrder.findFirstOrThrow()).cost_kopecks).toBe(500n);
  });
});
