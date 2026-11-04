import { HttpException } from '@nestjs/common';
import { ProviderRequestError } from '@http';
import { CreateSimService } from './create-sim.service';

/**
 * B2B различает три исхода отправки поставщику. Критично для денег: таймаут/обрыв/5xx —
 * НЕ отказ (заявка могла дойти), его нельзя превращать в FAILED и освобождать резерв.
 */
describe('CreateSimService — исходы отправки для B2B', () => {
  const item = { id: 77, partner_id: 5, tariff: { sku_id: 'SKU', validity_period: 30 }, user: { name: 'Co', email: undefined } };

  function build(over: { joytel?: any; bc?: any } = {}) {
    const prisma = {
      sims: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 77, order_id: 1, user: { name: 'Co', email: null } }),
      },
    };
    const joyTel = { submitEsimOrder: jest.fn(), queryOrderStatus: jest.fn().mockResolvedValue({ data: {} }), ...over.joytel };
    const bc = { createEsimOrder: jest.fn(), ...over.bc };
    const events = { record: jest.fn() };
    const telegram = { notifyOrderSuccess: jest.fn(), notifyOrderError: jest.fn() };
    const svc = new CreateSimService(prisma as any, joyTel as any, { log: jest.fn(), error: jest.fn() } as any, bc as any, telegram as any, events as any);
    return { svc, prisma, joyTel, bc, events, telegram };
  }
  const failedWrites = (prisma: any) => prisma.sims.update.mock.calls.filter((c: any[]) => c[0]?.data?.status === 'FAILED');

  it('JoyTel принял → ACCEPTED, SIM переведена в REDEEM_COUPON', async () => {
    const { svc, prisma } = build({ joytel: { submitEsimOrder: jest.fn().mockResolvedValue({ code: 0, data: { orderTid: 'T', orderCode: 'C' } }) } });
    const out = await svc.submitJoyTelForB2b(1, item);
    expect(out.kind).toBe('ACCEPTED');
    expect(prisma.sims.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REDEEM_COUPON' }) }));
  });

  it('ответ JoyTel с кодом отказа → REJECTED и SIM помечена FAILED', async () => {
    const { svc, prisma } = build({ joytel: { submitEsimOrder: jest.fn().mockResolvedValue({ code: 17, message: 'no stock' }) } });
    const out = await svc.submitJoyTelForB2b(1, item);
    expect(out).toMatchObject({ kind: 'REJECTED', reason: 'no stock' });
    expect(failedWrites(prisma)).toHaveLength(1);
  });

  it('HTTP 4xx от поставщика → REJECTED (запрос отвергнут)', async () => {
    const { svc, prisma } = build({ joytel: { submitEsimOrder: jest.fn().mockRejectedValue(new ProviderRequestError('JoyTel order failed', 422, { e: 1 })) } });
    expect((await svc.submitJoyTelForB2b(1, item)).kind).toBe('REJECTED');
    expect(failedWrites(prisma)).toHaveLength(1);
  });

  it.each([
    ['нет ответа (таймаут/обрыв)', new ProviderRequestError('JoyTel order failed', undefined)],
    ['HTTP 500 от поставщика', new ProviderRequestError('JoyTel order failed', 500)],
    ['HTTP 502', new ProviderRequestError('JoyTel order failed', 502)],
    ['произвольное исключение', new Error('socket hang up')],
    ['HttpException без типа провайдера', new HttpException('x', 400)],
  ])('НЕИЗВЕСТНЫЙ ИСХОД: %s → UNKNOWN, SIM не помечается FAILED, пишется событие', async (_name, err) => {
    const { svc, prisma, events } = build({ joytel: { submitEsimOrder: jest.fn().mockRejectedValue(err) } });
    const out = await svc.submitJoyTelForB2b(1, item);
    expect(out.kind).toBe('UNKNOWN');
    expect(failedWrites(prisma)).toHaveLength(0);
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'joytel_submit_unknown', severity: 'warning' }));
  });

  it('BillionConnect: tradeCode≠1000 → REJECTED; успех → ACCEPTED (NOTIFY_COUPON); таймаут → UNKNOWN', async () => {
    let t = build({ bc: { createEsimOrder: jest.fn().mockResolvedValue({ tradeCode: '2001', tradeMsg: 'bad sku' }) } });
    expect(await t.svc.submitBillionForB2b(1, item)).toMatchObject({ kind: 'REJECTED', reason: 'bad sku' });

    t = build({ bc: { createEsimOrder: jest.fn().mockResolvedValue({ tradeCode: '1000', tradeData: { successFlag: 'true', orderId: 'O1' } }) } });
    expect((await t.svc.submitBillionForB2b(1, item)).kind).toBe('ACCEPTED');
    expect(t.prisma.sims.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'NOTIFY_COUPON' }) }));

    t = build({ bc: { createEsimOrder: jest.fn().mockRejectedValue(new ProviderRequestError('BC failed', undefined)) } });
    expect((await t.svc.submitBillionForB2b(1, item)).kind).toBe('UNKNOWN');
    expect(failedWrites(t.prisma)).toHaveLength(0);
  });

  it('SIM уже взята в работу → UNKNOWN и поставщик не вызывается (повторной покупки нет)', async () => {
    const { svc, prisma, joyTel } = build();
    prisma.sims.updateMany.mockResolvedValue({ count: 0 });
    expect((await svc.submitJoyTelForB2b(1, item)).kind).toBe('UNKNOWN');
    expect(joyTel.submitEsimOrder).not.toHaveBeenCalled();
  });
});
