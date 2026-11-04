import { InsufficientFundsException, InvalidStateException, IdempotencyConflictException } from '../b2b.errors';
import { createTestPrisma, describeDb, resetB2bTables, seedPartner, seedReseller, seedResellerOrder, seedTariff } from '../testing/db';
import { ResellerLedgerService } from './reseller-ledger.service';

describeDb('ResellerLedgerService (реальный Postgres)', () => {
  const prisma = createTestPrisma();
  const ledger = new ResellerLedgerService(prisma);
  let resellerId: number;
  let tariffId: number;

  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetB2bTables(prisma);
    const partner = await seedPartner(prisma);
    tariffId = (await seedTariff(prisma, partner.id)).id;
    resellerId = (await seedReseller(prisma, 'Yatumo', 0n)).id;
  });

  const order = (n: string, price = 100n) =>
    seedResellerOrder(prisma, { resellerId, tariffId, clientOrderId: n, price });
  const balance = () => ledger.getBalance(resellerId);

  it('пополнение увеличивает баланс и пишет проводку с остатком', async () => {
    const res = await ledger.topUp({ resellerId, amount: 10_000n, comment: 'предоплата', actor: 'su', idempotencyKey: 'top-1' });
    expect(res.applied).toBe(true);
    expect(res.entry.balance_after).toBe(10_000n);
    expect(await balance()).toEqual({ balance: 10_000n, reserved: 0n, available: 10_000n });
  });

  it('пополнение и корректировка требуют комментарий', async () => {
    await expect(ledger.topUp({ resellerId, amount: 100n, comment: ' ', idempotencyKey: 'k' })).rejects.toMatchObject({
      response: { code: 'INVALID_AMOUNT' },
    });
    await expect(ledger.adjust({ resellerId, amount: 100n, comment: '', idempotencyKey: 'k' })).rejects.toBeDefined();
  });

  it('повтор пополнения с тем же ключом не зачисляет деньги второй раз; с другой суммой — конфликт', async () => {
    const args = { resellerId, amount: 500n, comment: 'тест', idempotencyKey: 'same' };
    await ledger.topUp(args);
    const again = await ledger.topUp(args);
    expect(again.applied).toBe(false);
    expect((await balance()).balance).toBe(500n);
    await expect(ledger.topUp({ ...args, amount: 999n })).rejects.toBeInstanceOf(IdempotencyConflictException);
  });

  it('резерв уменьшает доступную сумму; недостаток средств отклоняется и ничего не меняет', async () => {
    await ledger.topUp({ resellerId, amount: 1_000n, comment: 'тест', idempotencyKey: 't' });
    const o1 = await order('o1', 700n);
    await prisma.$transaction((tx) => ledger.reserve(tx, { resellerId, orderId: o1.id, amount: 700n }));
    expect(await balance()).toEqual({ balance: 1_000n, reserved: 700n, available: 300n });

    const o2 = await order('o2', 400n);
    await expect(
      prisma.$transaction((tx) => ledger.reserve(tx, { resellerId, orderId: o2.id, amount: 400n })),
    ).rejects.toBeInstanceOf(InsufficientFundsException);
    expect(await balance()).toEqual({ balance: 1_000n, reserved: 700n, available: 300n });
  });

  it('КОНКУРЕНТНОСТЬ: 20 параллельных покупок при балансе на 7 → ровно 7 резервов, баланс не уходит в минус', async () => {
    await ledger.topUp({ resellerId, amount: 700n, comment: 'тест', idempotencyKey: 't' });
    const orders = await Promise.all(Array.from({ length: 20 }, (_, i) => order(`c${i}`, 100n)));

    const results = await Promise.allSettled(
      orders.map((o) => prisma.$transaction((tx) => ledger.reserve(tx, { resellerId, orderId: o.id, amount: 100n }))),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(7);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(13);
    expect(rejected.every((r) => r.reason instanceof InsufficientFundsException)).toBe(true);
    expect(await balance()).toEqual({ balance: 700n, reserved: 700n, available: 0n });
  });

  it('capture превращает резерв в списание; повтор — no-op; release после capture запрещён', async () => {
    await ledger.topUp({ resellerId, amount: 1_000n, comment: 'тест', idempotencyKey: 't' });
    const o = await order('o1', 600n);
    const p = { resellerId, orderId: o.id, amount: 600n };
    await prisma.$transaction((tx) => ledger.reserve(tx, p));
    const first = await prisma.$transaction((tx) => ledger.capture(tx, p));
    const second = await prisma.$transaction((tx) => ledger.capture(tx, p));

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(await balance()).toEqual({ balance: 400n, reserved: 0n, available: 400n });
    await expect(prisma.$transaction((tx) => ledger.release(tx, p))).rejects.toBeInstanceOf(InvalidStateException);
  });

  it('release освобождает резерв один раз; capture после release запрещён', async () => {
    await ledger.topUp({ resellerId, amount: 1_000n, comment: 'тест', idempotencyKey: 't' });
    const o = await order('o1', 600n);
    const p = { resellerId, orderId: o.id, amount: 600n };
    await prisma.$transaction((tx) => ledger.reserve(tx, p));
    await prisma.$transaction((tx) => ledger.release(tx, p));
    const again = await prisma.$transaction((tx) => ledger.release(tx, p));

    expect(again.applied).toBe(false);
    expect(await balance()).toEqual({ balance: 1_000n, reserved: 0n, available: 1_000n });
    await expect(prisma.$transaction((tx) => ledger.capture(tx, p))).rejects.toBeInstanceOf(InvalidStateException);
  });

  it('capture/release с суммой, не равной резерву, отклоняется', async () => {
    await ledger.topUp({ resellerId, amount: 1_000n, comment: 'тест', idempotencyKey: 't' });
    const o = await order('o1', 600n);
    await prisma.$transaction((tx) => ledger.reserve(tx, { resellerId, orderId: o.id, amount: 600n }));
    await expect(
      prisma.$transaction((tx) => ledger.capture(tx, { resellerId, orderId: o.id, amount: 100n })),
    ).rejects.toBeInstanceOf(InvalidStateException);
  });

  it('возврат возможен только после списания и только один раз', async () => {
    await ledger.topUp({ resellerId, amount: 1_000n, comment: 'тест', idempotencyKey: 't' });
    const o = await order('o1', 600n);
    const p = { resellerId, orderId: o.id, amount: 600n };
    await expect(
      prisma.$transaction((tx) => ledger.refund(tx, { ...p, comment: 'возврат' })),
    ).rejects.toBeInstanceOf(InvalidStateException);

    await prisma.$transaction((tx) => ledger.reserve(tx, p));
    await prisma.$transaction((tx) => ledger.capture(tx, p));
    const r1 = await prisma.$transaction((tx) => ledger.refund(tx, { ...p, comment: 'возврат' }));
    const r2 = await prisma.$transaction((tx) => ledger.refund(tx, { ...p, comment: 'возврат' }));
    expect(r1.applied).toBe(true);
    expect(r2.applied).toBe(false);
    expect((await balance()).balance).toBe(1_000n);
  });

  it('отрицательная корректировка не может превысить доступную сумму', async () => {
    await ledger.topUp({ resellerId, amount: 1_000n, comment: 'тест', idempotencyKey: 't' });
    const o = await order('o1', 800n);
    await prisma.$transaction((tx) => ledger.reserve(tx, { resellerId, orderId: o.id, amount: 800n }));
    await expect(
      ledger.adjust({ resellerId, amount: -300n, comment: 'списание', idempotencyKey: 'a1' }),
    ).rejects.toBeInstanceOf(InsufficientFundsException);
    const ok = await ledger.adjust({ resellerId, amount: -200n, comment: 'списание', idempotencyKey: 'a2' });
    expect(ok.entry.balance_after).toBe(800n);
  });

  it('журнал неизменяем: UPDATE и DELETE отклоняет сама БД', async () => {
    const { entry } = await ledger.topUp({ resellerId, amount: 100n, comment: 'тест', idempotencyKey: 't' });
    await expect(prisma.resellerLedger.update({ where: { id: entry.id }, data: { comment: 'подмена' } })).rejects.toThrow(/append-only/);
    await expect(prisma.resellerLedger.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });

  it('listLedger отдаёт проводки от новых к старым с остатками', async () => {
    await ledger.topUp({ resellerId, amount: 100n, comment: 'первая', idempotencyKey: 't1' });
    await ledger.topUp({ resellerId, amount: 50n, comment: 'вторая', idempotencyKey: 't2' });
    const rows = await ledger.listLedger(resellerId);
    expect(rows.map((r) => r.balance_after)).toEqual([150n, 100n]);
  });
});
