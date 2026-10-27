import { normalizeBc, normalizeJoytel, normalizeMobiline } from './usage.normalizer';

const now = new Date('2026-09-18T12:00:00Z');
const tariff = { quantity_internet: 5, validity_period: 15 };
const sim = { iccid: '89852340000000000001', sub_order_id: 'wanted', tariff };
const detail = {
  ICCID: sim.iccid,
  quota: -1,
  remain_quota: 999999,
  plan_quota: '999',
  plan_days: 15,
  sim_activated: true,
  start_using_time: '2026-09-11 08:54:01',
  expire_time: '2026-09-26 08:54:01',
  cdr: [
    { date: '20260918', bytes: 94717870 },
    { date: '2026-09-11', bytes: 1153423114 },
  ],
};
describe('Provider balance normalization (Happytel response shapes)', () => {
  it('uses Joytel bytes, plan GB and millisecond timestamps', () => {
    const result = normalizeJoytel(
      {
        code: '000',
        data: { totalUsage: 1073741824, effTime: now.getTime() - 86400000, expTime: now.getTime() + 86400000 },
      },
      tariff,
      now,
    );
    expect(result).toMatchObject({
      used_mb: 1024,
      total_mb: 5120,
      remaining_mb: 4096,
      remaining_days: 1,
      state: 'active',
    });
  });
  it.each(['0', '000', 0])('accepts Joytel success code %s', (code) => {
    expect(normalizeJoytel({ code, data: { totalUsage: 0 } }, tariff, now).state).toBe('not_activated');
  });
  it.each([{ code: '1002' }, { code: '000', data: {} }, { code: '000', data: { totalUsage: -1 } }])(
    'rejects missing/error counters rather than reporting zero',
    (response) => {
      expect(() => normalizeJoytel(response, tariff, now)).toThrow();
    },
  );
  it('caps remaining at zero and handles unlimited Joytel tariffs', () => {
    expect(normalizeJoytel({ code: 0, data: { totalUsage: 20 * 1024 ** 3 } }, tariff, now).remaining_mb).toBe(0);
    expect(
      normalizeJoytel({ code: 0, data: { totalUsage: 0 } }, { ...tariff, quantity_internet: -1 }, now),
    ).toMatchObject({ is_unlimited: true, total_mb: null, remaining_mb: null });
  });
  const plans = {
    tradeCode: '1000',
    tradeData: [
      {
        orderId: 'order',
        subOrderList: [
          { subOrderId: 'other', planStatus: '1', usedTraffic: 1000, totalTraffic: 999 },
          {
            subOrderId: 'wanted',
            planStatus: '1',
            usedTraffic: 2097152,
            totalTraffic: 5242880,
            planStartTime: '2026-09-11 12:00:00',
            planEndTime: '2026-09-26 12:00:00',
          },
        ],
      },
    ],
  };
  it('selects the purchased BC suborder and uses the larger KB counter', () => {
    const result = normalizeBc(
      plans,
      {
        tradeCode: '1000',
        tradeData: {
          subOrderList: [
            { subOrderId: 'other', usageInfoList: [{ usageAmt: 99999999 }] },
            { subOrderId: 'wanted', usageInfoList: [{ usageAmt: 1048576, usedDate: '20260918' }] },
          ],
        },
      },
      sim,
      now,
    );
    expect(result).toMatchObject({
      used_mb: 2048,
      total_mb: 5120,
      remaining_mb: 3072,
      activated_at: '2026-09-11T04:00:00.000Z',
    });
  });
  it('retains valid BC plan counters when F046 is unavailable', () => {
    expect(normalizeBc(plans, null, sim, now).used_mb).toBe(2048);
  });
  it('rejects BC errors and missing plans', () => {
    expect(() => normalizeBc({ tradeCode: '5000' }, null, sim, now)).toThrow();
    expect(() => normalizeBc({ tradeCode: '1000', tradeData: [] }, null, sim, now)).toThrow();
  });
  it('uses CDR when SkyBlue counters are -1 and recognizes unlimited plans', () => {
    const result = normalizeMobiline(detail, sim, now);
    expect(result).toMatchObject({
      is_unlimited: true,
      remaining_mb: null,
      total_mb: null,
      used_mb: Math.round(((94717870 + 1153423114) / 1048576) * 100) / 100,
      activated_at: '2026-09-10T23:54:01.000Z',
      expires_at: '2026-09-25T23:54:01.000Z',
      remaining_days: 8,
    });
    expect(result.daily_usage.map((r) => r.date)).toEqual(['2026-09-11', '2026-09-18']);
  });
  it('handles finite SkyBlue counters and UTC daily passes', () => {
    const result = normalizeMobiline(
      {
        ...detail,
        quota: 3 * 1024 ** 3,
        remain_quota: 2 * 1024 ** 3,
        used_quota: 1024 ** 3,
        daypass: true,
        daily_quota: 1024 ** 3,
      },
      sim,
      now,
    );
    expect(result).toMatchObject({
      total_mb: 3072,
      remaining_mb: 2048,
      used_mb: 1024,
      daily_quota_mb: 1024,
      today_used_mb: 90.33,
    });
  });
  it('rejects another ICCID and missing Mobiline counters', () => {
    expect(() => normalizeMobiline({ ...detail, ICCID: 'other' }, sim, now)).toThrow();
    expect(() => normalizeMobiline({ ICCID: sim.iccid }, sim, now)).toThrow();
    expect(() => normalizeMobiline({ ICCID: sim.iccid, quota: 3072, remain_quota: 2048 }, sim, now)).toThrow();
  });
  it('reports expiry from provider time rather than the purchase date', () => {
    expect(normalizeMobiline(detail, sim, new Date('2026-10-01T00:00:00Z'))).toMatchObject({
      state: 'expired',
      remaining_days: 0,
    });
  });
});
