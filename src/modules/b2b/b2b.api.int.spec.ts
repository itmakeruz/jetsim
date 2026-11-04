import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@prisma';
import { MGMT_KEY, createB2bTestApp } from './testing/app';
import { createTestPrisma, describeDb, resetB2bTables, seedPartner, seedTariff } from './testing/db';

describeDb('B2B API (центральный JetSim, реальный Postgres)', () => {
  const prisma: PrismaService = createTestPrisma();
  let app: INestApplication;
  let h: Awaited<ReturnType<typeof createB2bTestApp>>;
  let tariffId: number;

  const admin = (m: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string) =>
    (request(app.getHttpServer()) as any)[m](`/b2b-admin${url}`).set('X-Management-Key', MGMT_KEY);
  const partner = (m: 'get' | 'post', url: string, key: string) =>
    (request(app.getHttpServer()) as any)[m](`/b2b${url}`).set('X-Reseller-Key', key);

  /** Компания с ключом, тарифом (цена price) и балансом, всё через управляющее API */
  async function company(name: string, o: { price?: number; balance?: number; currency?: 'RUB' | 'USD' } = {}) {
    const r = (await admin('post', '/resellers').send({ name, ...(o.currency ? { currency: o.currency } : {}) }).expect(201)).body;
    const key = (await admin('post', `/resellers/${r.id}/keys`).send({ name: 'site' }).expect(201)).body.key as string;
    await admin('put', `/resellers/${r.id}/tariffs/${tariffId}`).send({ price_kopecks: o.price ?? 10_000 }).expect(200);
    if (o.balance) await admin('post', `/resellers/${r.id}/topups`).send({ amount_kopecks: o.balance, comment: 'предоплата' }).expect(201);
    return { id: r.id as number, key };
  }
  const order = (key: string, body: Record<string, unknown>) => partner('post', '/orders', key).send(body);
  const balance = async (key: string) => (await partner('get', '/balance', key).expect(200)).body;

  beforeAll(async () => {
    await prisma.$connect();
    h = await createB2bTestApp(prisma);
    app = h.app;
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetB2bTables(prisma);
    const p = await seedPartner(prisma, 1);
    tariffId = (await seedTariff(prisma, p.id)).id;
    h.submitter.submit.mockReset();
    h.alerts.reconcileNeeded.mockClear();
    h.enqueue.mockClear();
  });

  // ------------------------------------------------------------------ доступ
  describe('аутентификация ключей', () => {
    it('управляющее API закрыто без ключа и с чужим ключом; закупочный ключ его не открывает', async () => {
      const c = await company('Comp A');
      await request(app.getHttpServer()).get('/b2b-admin/resellers').expect(401);
      await request(app.getHttpServer()).get('/b2b-admin/resellers').set('X-Management-Key', 'wrong').expect(401);
      await request(app.getHttpServer()).get('/b2b-admin/resellers').set('X-Management-Key', c.key).expect(401);
    });

    it('управляющий ключ не открывает закупочные методы; мусорный и отозванный ключ — 401', async () => {
      const c = await company('Comp A');
      await request(app.getHttpServer()).get('/b2b/tariffs').set('X-Reseller-Key', MGMT_KEY).expect(401);
      await partner('get', '/tariffs', 'jrk_zzzzzzzz_bad').expect(401);
      await partner('get', '/tariffs', c.key).expect(200);

      const keyId = (await admin('get', `/resellers/${c.id}/keys`).expect(200)).body[0].id;
      await admin('delete', `/resellers/${c.id}/keys/${keyId}`).expect(200);
      await partner('get', '/tariffs', c.key).expect(401);
    });

    it('в БД хранится только хеш ключа, значение показывается один раз', async () => {
      const c = await company('Comp A');
      const rows = await prisma.resellerApiKey.findMany();
      expect(JSON.stringify(rows)).not.toContain(c.key.split('_')[2]);
      const listed = (await admin('get', `/resellers/${c.id}/keys`).expect(200)).body;
      expect(JSON.stringify(listed)).not.toContain(c.key);
    });
  });

  // ------------------------------------------------------------------ каталог
  it('каталог: цена и версия компании; без sku, поставщика и нашей себестоимости', async () => {
    const c = await company('Comp A', { price: 12_345 });
    const body = (await partner('get', '/tariffs', c.key).expect(200)).body;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: tariffId, price_kopecks: 12_345, price_version: 1, currency: 'RUB' });
    expect(JSON.stringify(body)).not.toMatch(/sku|SKU-1|partner|provider|cost|arrival/i);
  });

  it('смена цены повышает версию; повтор той же цены — нет', async () => {
    const c = await company('Comp A', { price: 10_000 });
    const put = (price: number) => admin('put', `/resellers/${c.id}/tariffs/${tariffId}`).send({ price_kopecks: price }).expect(200);
    expect((await put(10_000)).body.price_version).toBe(1);
    expect((await put(11_000)).body.price_version).toBe(2);
    expect((await put(11_000)).body.price_version).toBe(2);
  });

  // ------------------------------------------------------------------ заказы
  describe('создание заказа', () => {
    it('202, резервирует закупочную цену; ответ не раскрывает внутренние состояния и поставщиков', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 25_000 });
      const res = await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1, source: 'API_KEY' }).expect(202);

      expect(res.body).toMatchObject({ client_order_id: 'o-1', status: 'PROCESSING', price_kopecks: 10_000 });
      expect(Object.keys(res.body)).not.toEqual(expect.arrayContaining(['state', 'provider_response', 'state_reason']));
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 25_000, reserved_kopecks: 10_000, available_kopecks: 15_000 });
      expect(h.enqueue).toHaveBeenCalledTimes(1);
    });

    it('повтор с теми же параметрами возвращает тот же заказ и не резервирует второй раз', async () => {
      const c = await company('Comp A', { balance: 30_000 });
      const body = { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 };
      const first = await order(c.key, body).expect(202);
      const again = await order(c.key, body).expect(202);

      expect(again.body.id).toBe(first.body.id);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 10_000 });
      expect(await prisma.resellerOrder.count()).toBe(1);
      expect(h.enqueue).toHaveBeenCalledTimes(1);
    });

    it('тот же client_order_id с другим содержимым — 409 IDEMPOTENCY_CONFLICT', async () => {
      const c = await company('Comp A', { balance: 30_000 });
      await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202);
      const res = await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 2 }).expect(409);
      expect(res.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('КОНКУРЕНТНОСТЬ: 10 одинаковых запросов параллельно → один заказ, один резерв', async () => {
      const c = await company('Comp A', { balance: 100_000 });
      const body = { client_order_id: 'dup', tariff_id: tariffId, price_version: 1 };
      const results = await Promise.all(Array.from({ length: 10 }, () => order(c.key, body)));

      expect(results.every((r) => r.status === 202)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(await prisma.resellerOrder.count()).toBe(1);
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 10_000 });
    });

    it('КОНКУРЕНТНОСТЬ: 12 разных заказов при балансе на 5 → ровно 5 принято, остальные INSUFFICIENT_FUNDS', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 50_000 });
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) => order(c.key, { client_order_id: `p-${i}`, tariff_id: tariffId, price_version: 1 })),
      );
      expect(results.filter((r) => r.status === 202)).toHaveLength(5);
      expect(results.filter((r) => r.status === 422 && r.body.code === 'INSUFFICIENT_FUNDS')).toHaveLength(7);
      expect(await prisma.resellerOrder.count()).toBe(5);
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 50_000, available_kopecks: 0 });
    });

    it('недостаточно средств → 422 и заказ не создаётся', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 5_000 });
      const res = await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(422);
      expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
      expect(await prisma.resellerOrder.count()).toBe(0);
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 0 });
    });

    it('устаревшая версия цены → 409 PRICE_CHANGED без списания; новая версия проходит; старый заказ сохраняет свою цену', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 100_000 });
      await order(c.key, { client_order_id: 'old', tariff_id: tariffId, price_version: 1 }).expect(202);
      await admin('put', `/resellers/${c.id}/tariffs/${tariffId}`).send({ price_kopecks: 15_000 }).expect(200);

      const stale = await order(c.key, { client_order_id: 'new-stale', tariff_id: tariffId, price_version: 1 }).expect(409);
      expect(stale.body.code).toBe('PRICE_CHANGED');
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 10_000 });

      const fresh = await order(c.key, { client_order_id: 'new-ok', tariff_id: tariffId, price_version: 2 }).expect(202);
      expect(fresh.body.price_kopecks).toBe(15_000);
      const old = await partner('get', '/orders/old', c.key).expect(200);
      expect(old.body.price_kopecks).toBe(10_000);
    });

    it('недоступный тариф: не назначен, выключен или снят в центре → 422 TARIFF_UNAVAILABLE', async () => {
      const c = await company('Comp A', { balance: 100_000 });
      const other = await seedTariff(prisma, (await prisma.partner.findFirst())!.id, { sku_id: 'SKU-2' });
      let res = await order(c.key, { client_order_id: 'x1', tariff_id: other.id, price_version: 1 }).expect(422);
      expect(res.body.code).toBe('TARIFF_UNAVAILABLE');

      await admin('put', `/resellers/${c.id}/tariffs/${tariffId}`).send({ price_kopecks: 10_000, active: false }).expect(200);
      res = await order(c.key, { client_order_id: 'x2', tariff_id: tariffId, price_version: 1 }).expect(422);
      expect(res.body.code).toBe('TARIFF_UNAVAILABLE');

      await admin('put', `/resellers/${c.id}/tariffs/${tariffId}`).send({ price_kopecks: 10_000, active: true }).expect(200);
      await prisma.tariff.update({ where: { id: tariffId }, data: { status: 'INACTIVE' } });
      res = await order(c.key, { client_order_id: 'x3', tariff_id: tariffId, price_version: 1 }).expect(422);
      expect(res.body.code).toBe('TARIFF_UNAVAILABLE');
      expect((await partner('get', '/tariffs', c.key).expect(200)).body).toHaveLength(0);
    });

    it.each([
      [{ client_order_id: '', tariff_id: 1, price_version: 1 }],
      [{ client_order_id: 'a b', tariff_id: 1, price_version: 1 }],
      [{ client_order_id: 'x'.repeat(65), tariff_id: 1, price_version: 1 }],
      [{ client_order_id: 'ok', tariff_id: 'abc', price_version: 1 }],
      [{ client_order_id: 'ok', tariff_id: 1 }],
      [{}],
    ])('некорректное тело %j → 400, без побочных эффектов', async (body) => {
      const c = await company('Comp A', { balance: 100_000 });
      await order(c.key, body as any).expect(400);
      expect(await prisma.resellerOrder.count()).toBe(0);
    });
  });

  describe('блокировка компании', () => {
    it('новые покупки запрещены (403), но каталог, баланс и ранее выданная eSIM доступны; повтор старого заказа тоже', async () => {
      const c = await company('Comp A', { balance: 100_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      await issue(ro.id);
      await admin('patch', `/resellers/${c.id}`).send({ status: 'BLOCKED' }).expect(200);

      const res = await order(c.key, { client_order_id: 'o-2', tariff_id: tariffId, price_version: 1 }).expect(403);
      expect(res.body.code).toBe('COMPANY_BLOCKED');
      await partner('get', '/tariffs', c.key).expect(200);
      await partner('get', '/balance', c.key).expect(200);
      await partner('get', '/orders/o-1/esim', c.key).expect(200);
      await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202);
    });
  });

  // -------------------------------------------------------------- изоляция
  describe('изоляция компаний', () => {
    it('чужой заказ, eSIM, QR и расход — 404, неотличимо от несуществующего; список только свой', async () => {
      const a = await company('Comp A', { balance: 100_000 });
      const b = await company('Comp B', { balance: 100_000 });
      const ro = (await order(a.key, { client_order_id: 'secret', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      await issue(ro.id);

      for (const path of ['/orders/secret', '/orders/secret/esim', '/orders/secret/qr', '/orders/secret/usage', '/orders/nope']) {
        const res = await partner('get', path, b.key).expect(404);
        expect(res.body.code).toBe('ORDER_NOT_FOUND');
      }
      expect((await partner('get', '/orders', b.key).expect(200)).body).toEqual([]);
      expect((await partner('get', '/orders', a.key).expect(200)).body).toHaveLength(1);
      await partner('get', '/orders/secret/esim', a.key).expect(200);
    });

    it('одинаковый client_order_id у разных компаний — независимые заказы', async () => {
      const a = await company('Comp A', { balance: 100_000 });
      const b = await company('Comp B', { balance: 100_000 });
      const body = { client_order_id: 'same', tariff_id: tariffId, price_version: 1 };
      const ra = (await order(a.key, body).expect(202)).body;
      const rb = (await order(b.key, body).expect(202)).body;
      expect(ra.id).not.toBe(rb.id);
    });
  });

  // ------------------------------------------------- выпуск, деньги, сверка
  /** Имитирует выпуск: отправка принята, провайдерский колбэк завершил SIM, расчёт списал резерв */
  async function issue(resellerOrderId: number) {
    h.submitter.submit.mockResolvedValueOnce({ kind: 'ACCEPTED', response: { ok: true } });
    await h.issuance.submit(resellerOrderId);
    await prisma.sims.updateMany({
      where: { reseller_order_id: resellerOrderId },
      data: { status: 'COMPLETED', iccid: '8999000000000000001', qrcode: 'LPA:1$smdp.example.com$MATCH-123' },
    });
    await h.settlement.run();
  }

  describe('выпуск и расчёты', () => {
    it('принято поставщиком → SUBMITTED, затем выдача → ISSUED и резерв превращается в списание (один раз)', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;

      h.submitter.submit.mockResolvedValueOnce({ kind: 'ACCEPTED', response: { ok: true } });
      await h.issuance.submit(ro.id);
      const submitted = await prisma.resellerOrder.findUniqueOrThrow({ where: { id: ro.id }, include: { sim: true, order: true } });
      expect(submitted.state).toBe('SUBMITTED');
      expect(submitted.sim?.reseller_order_id).toBe(ro.id);
      expect(submitted.order?.reseller_order_id).toBe(ro.id);
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 25_000, reserved_kopecks: 10_000 });

      await prisma.sims.update({ where: { id: submitted.sim!.id }, data: { status: 'COMPLETED' } });
      await h.settlement.run();
      await h.settlement.run();
      expect((await prisma.resellerOrder.findUniqueOrThrow({ where: { id: ro.id } })).state).toBe('ISSUED');
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 15_000, reserved_kopecks: 0, available_kopecks: 15_000 });
      expect(await prisma.resellerLedger.count({ where: { type: 'CAPTURE' } })).toBe(1);
      expect((await partner('get', '/orders/o-1', c.key).expect(200)).body.status).toBe('ISSUED');
    });

    it('достоверный отказ → FAILED, резерв освобождён один раз, поставщик вызван один раз', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      h.submitter.submit.mockResolvedValue({ kind: 'REJECTED', reason: 'bad sku', response: { code: 17 } });

      await h.issuance.submit(ro.id);
      await h.issuance.submit(ro.id);

      expect(h.submitter.submit).toHaveBeenCalledTimes(1);
      expect((await partner('get', '/orders/o-1', c.key).expect(200)).body.status).toBe('FAILED');
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 25_000, reserved_kopecks: 0 });
      expect(await prisma.resellerLedger.count({ where: { type: 'RELEASE' } })).toBe(1);
    });

    it('ТАЙМАУТ ПОСТАВЩИКА: исключение отправителя → RECONCILE, резерв удержан, повторной покупки нет, оператору сигнал', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      h.submitter.submit.mockRejectedValue(new Error('ETIMEDOUT'));

      await h.issuance.submit(ro.id);
      await h.issuance.submit(ro.id);
      await h.settlement.run();

      const row = await prisma.resellerOrder.findUniqueOrThrow({ where: { id: ro.id } });
      expect(row.state).toBe('RECONCILE');
      expect(row.state_reason).toMatch(/UNKNOWN_OUTCOME/);
      expect(h.submitter.submit).toHaveBeenCalledTimes(1);
      expect(h.alerts.reconcileNeeded).toHaveBeenCalledTimes(1);
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 10_000 });
      expect(await prisma.resellerLedger.count({ where: { type: { in: ['RELEASE', 'CAPTURE'] } } })).toBe(0);
      // Партнёр видит обычное «в работе», а не нашу внутреннюю кухню
      expect((await partner('get', '/orders/o-1', c.key).expect(200)).body.status).toBe('PROCESSING');
    });

    it('неизвестный исход потом подтверждён колбэком: eSIM выдана → списание; сообщили об отказе → освобождение', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 40_000 });
      const a = (await order(c.key, { client_order_id: 'a', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      const b = (await order(c.key, { client_order_id: 'b', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      h.submitter.submit.mockResolvedValue({ kind: 'UNKNOWN', reason: '5xx' });
      await h.issuance.submit(a.id);
      await h.issuance.submit(b.id);

      await prisma.sims.updateMany({ where: { reseller_order_id: a.id }, data: { status: 'COMPLETED' } });
      await prisma.sims.updateMany({ where: { reseller_order_id: b.id }, data: { status: 'FAILED' } });
      await h.settlement.run();

      expect((await prisma.resellerOrder.findUniqueOrThrow({ where: { id: a.id } })).state).toBe('ISSUED');
      expect((await prisma.resellerOrder.findUniqueOrThrow({ where: { id: b.id } })).state).toBe('FAILED');
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 30_000, reserved_kopecks: 0 });
    });

    it('процесс умер посреди отправки: SUBMITTING старше 5 минут → RECONCILE (без повторной отправки)', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      await prisma.resellerOrder.update({ where: { id: ro.id }, data: { state: 'SUBMITTING', submitting_at: new Date(Date.now() - 6 * 60_000) } });

      await h.settlement.run();

      expect((await prisma.resellerOrder.findUniqueOrThrow({ where: { id: ro.id } })).state).toBe('RECONCILE');
      expect(h.submitter.submit).not.toHaveBeenCalled();
      expect(h.alerts.reconcileNeeded).toHaveBeenCalledTimes(1);
    });

    it('потерянный фоновый запуск: RESERVED старше 30 с подхватывается расчётом', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      await prisma.resellerOrder.update({ where: { id: ro.id }, data: { created_at: new Date(Date.now() - 60_000) } });
      h.enqueue.mockClear();

      await h.settlement.run();

      expect(h.enqueue).toHaveBeenCalledWith(ro.id);
    });
  });

  describe('отмена, сверка и возврат (суперадмин)', () => {
    const adminAction = (id: number, action: string, body: object) => admin('post', `/orders/${id}/${action}`).send(body);

    it('отмена до отправки освобождает резерв; поставщику потом ничего не уходит', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;

      await adminAction(ro.id, 'cancel', { comment: 'клиент передумал' }).expect(200);
      await h.issuance.submit(ro.id);

      expect(h.submitter.submit).not.toHaveBeenCalled();
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 0 });
      expect((await partner('get', '/orders/o-1', c.key).expect(200)).body.status).toBe('CANCELLED');
    });

    it('после отправки поставщику отмена невозможна (409) — простая смена статуса не возвращает деньги', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      h.submitter.submit.mockResolvedValueOnce({ kind: 'ACCEPTED' });
      await h.issuance.submit(ro.id);

      const res = await adminAction(ro.id, 'cancel', { comment: 'отмена' }).expect(409);
      expect(res.body.code).toBe('INVALID_STATE');
      expect(await balance(c.key)).toMatchObject({ reserved_kopecks: 10_000 });
    });

    it('сверка RECONCILE → FAILED освобождает резерв и закрывает SIM; → ISSUED списывает; повторная сверка — 409', async () => {
      const c = await company('Comp A', { balance: 40_000 });
      const a = (await order(c.key, { client_order_id: 'a', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      const b = (await order(c.key, { client_order_id: 'b', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      h.submitter.submit.mockResolvedValue({ kind: 'UNKNOWN', reason: 'timeout' });
      await h.issuance.submit(a.id);
      await h.issuance.submit(b.id);

      await adminAction(a.id, 'reconcile', { outcome: 'FAILED', comment: 'у поставщика заказа нет' }).expect(200);
      await adminAction(b.id, 'reconcile', { outcome: 'ISSUED', comment: 'поставщик подтвердил выдачу' }).expect(200);
      await adminAction(a.id, 'reconcile', { outcome: 'ISSUED', comment: 'ещё раз' }).expect(409);

      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 30_000, reserved_kopecks: 0 });
      expect((await prisma.sims.findFirstOrThrow({ where: { reseller_order_id: a.id } })).status).toBe('FAILED');
    });

    it('возврат после выдачи — только ISSUED, только с подтверждением поставщика и только один раз', async () => {
      const c = await company('Comp A', { price: 10_000, balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;

      await adminAction(ro.id, 'refund', { provider_confirmed: true, comment: 'ранний возврат' }).expect(409);
      await issue(ro.id);
      await adminAction(ro.id, 'refund', { provider_confirmed: false, comment: 'без подтверждения' }).expect(409);
      await adminAction(ro.id, 'refund', { provider_confirmed: true, comment: 'поставщик вернул' }).expect(200);
      await adminAction(ro.id, 'refund', { provider_confirmed: true, comment: 'повтор' }).expect(409);

      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 25_000, reserved_kopecks: 0 });
      expect(await prisma.resellerLedger.count({ where: { type: 'REFUND' } })).toBe(1);
    });

    it('служебные данные (ответ поставщика, причина) видит только управляющее API', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      h.submitter.submit.mockResolvedValueOnce({ kind: 'REJECTED', reason: 'bad sku', response: { code: 17, mesg: 'JoyTel says no' } });
      await h.issuance.submit(ro.id);

      const adminView = (await admin('get', `/orders/${ro.id}`).expect(200)).body;
      expect(adminView.provider_response).toMatchObject({ code: 17 });
      expect(adminView.state).toBe('FAILED');
      expect(JSON.stringify((await partner('get', '/orders/o-1', c.key).expect(200)).body)).not.toMatch(/JoyTel|provider_response|bad sku|state_reason/);
    });
  });

  describe('валюта компании', () => {
    it('USD-компания: цены, баланс, резерв, списание и заказы — в долларах (центы); RUB-компания рядом остаётся в рублях', async () => {
      const usd = await company('Usd Co', { currency: 'USD', price: 1_250, balance: 10_000 });
      const rub = await company('Rub Co', { price: 99_000, balance: 500_000 });

      expect((await partner('get', '/tariffs', usd.key).expect(200)).body[0]).toMatchObject({ price_kopecks: 1_250, currency: 'USD' });
      expect((await partner('get', '/tariffs', rub.key).expect(200)).body[0]).toMatchObject({ price_kopecks: 99_000, currency: 'RUB' });
      expect(await balance(usd.key)).toMatchObject({ balance_kopecks: 10_000, currency: 'USD' });
      expect(await balance(rub.key)).toMatchObject({ balance_kopecks: 500_000, currency: 'RUB' });

      const t = (await partner('get', '/tariffs', usd.key)).body[0];
      const o = await order(usd.key, { client_order_id: 'u-1', tariff_id: t.id, price_version: t.price_version }).expect(202);
      expect(o.body).toMatchObject({ price_kopecks: 1_250, currency: 'USD' });
      expect(await balance(usd.key)).toMatchObject({ balance_kopecks: 10_000, reserved_kopecks: 1_250, available_kopecks: 8_750, currency: 'USD' });
      // чужая валюта не затронута
      expect(await balance(rub.key)).toMatchObject({ reserved_kopecks: 0, currency: 'RUB' });
      const list = (await admin('get', '/orders').expect(200)).body;
      expect(list.find((x: any) => x.client_order_id === 'u-1')).toMatchObject({ currency: 'USD' });
    });

    it('валюта задаётся при создании, неизвестная — 400; сменить её нельзя ни через API, ни напрямую в БД', async () => {
      await admin('post', '/resellers').send({ name: 'Eur Co', currency: 'EUR' }).expect(400);
      const c = await company('Usd Co', { currency: 'USD' });
      const upd = await admin('patch', `/resellers/${c.id}`).send({ currency: 'RUB' });
      expect([200, 400]).toContain(upd.status);
      expect((await admin('get', `/resellers/${c.id}`).expect(200)).body.currency).toBe('USD');
      await expect(prisma.reseller.update({ where: { id: c.id }, data: { currency: 'RUB' } })).rejects.toThrow();
    });
  });

  describe('деньги через управляющее API', () => {
    it('пополнение/корректировка требуют комментарий; идемпотентный повтор не зачисляет дважды', async () => {
      const c = await company('Comp A');
      await admin('post', `/resellers/${c.id}/topups`).send({ amount_kopecks: 1000 }).expect(400);
      await admin('post', `/resellers/${c.id}/topups`).send({ amount_kopecks: 1000, comment: 'x' }).expect(400);
      const body = { amount_kopecks: 5000, comment: 'предоплата', idempotency_key: 'k-1' };
      await admin('post', `/resellers/${c.id}/topups`).set('X-Actor', 'user:7:root').send(body).expect(201);
      const again = await admin('post', `/resellers/${c.id}/topups`).send(body).expect(201);
      expect(again.body.applied).toBe(false);
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 5000 });
      const ledger = (await admin('get', `/resellers/${c.id}/ledger`).expect(200)).body;
      expect(ledger[0]).toMatchObject({ type: 'TOPUP', actor: 'user:7:root', balance_after_kopecks: 5000 });
    });

    it('закупочный ключ компании не может пополнить баланс, менять цены или отменять заказы', async () => {
      const c = await company('Comp A', { balance: 10_000 });
      for (const [m, url] of [['post', `/b2b-admin/resellers/${c.id}/topups`], ['put', `/b2b-admin/resellers/${c.id}/tariffs/${tariffId}`], ['post', '/b2b-admin/orders/1/cancel']] as const) {
        await (request(app.getHttpServer()) as any)[m](url).set('X-Reseller-Key', c.key).send({ amount_kopecks: 1, comment: 'hack', price_kopecks: 1 }).expect(401);
      }
      expect(await balance(c.key)).toMatchObject({ balance_kopecks: 10_000 });
    });
  });

  // ---------------------------------------------------------------- eSIM
  describe('eSIM, QR и расход', () => {
    it('до выдачи — 409 NOT_ISSUED; после — ICCID, код активации и инструкции; QR — PNG без кэша', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      for (const p of ['esim', 'qr', 'usage']) {
        expect((await partner('get', `/orders/o-1/${p}`, c.key).expect(409)).body.code).toBe('NOT_ISSUED');
      }

      await issue(ro.id);
      const esim = (await partner('get', '/orders/o-1/esim', c.key).expect(200)).body;
      expect(esim).toMatchObject({ iccid: '8999000000000000001', smdp_address: 'smdp.example.com', matching_id: 'MATCH-123' });
      expect(esim.instructions.ru.length).toBeGreaterThan(0);
      expect(JSON.stringify(esim)).not.toMatch(/JoyTel|BillionConnect|Mobiline/i);

      const qr = await partner('get', '/orders/o-1/qr', c.key).buffer(true).parse((res: any, cb: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(qr.headers['content-type']).toContain('image/png');
      expect(qr.headers['cache-control']).toContain('no-store');
      expect((qr.body as Buffer).subarray(0, 4).toString('hex')).toBe('89504e47');
    });

    it('расход: нормализованный ответ; сбой поставщика не раскрывает детали', async () => {
      const c = await company('Comp A', { balance: 25_000 });
      const ro = (await order(c.key, { client_order_id: 'o-1', tariff_id: tariffId, price_version: 1 }).expect(202)).body;
      await issue(ro.id);

      h.usage.forSim.mockResolvedValueOnce({ status: 'ok', data: { state: 'active', used_mb: 10, total_mb: 5120 } });
      expect((await partner('get', '/orders/o-1/usage', c.key).expect(200)).body).toMatchObject({ status: 'ok', usage: { used_mb: 10 } });

      h.usage.forSim.mockRejectedValueOnce(new Error('JoyTel secret internals'));
      const res = await partner('get', '/orders/o-1/usage', c.key).expect(502);
      expect(res.body.code).toBe('USAGE_UNAVAILABLE');
      expect(JSON.stringify(res.body)).not.toMatch(/JoyTel|secret/);
    });
  });
});
