export interface UsageData {
  state: 'not_activated' | 'active' | 'expired' | 'depleted';
  is_unlimited: boolean;
  total_mb: number | null;
  used_mb: number;
  remaining_mb: number | null;
  daily_quota_mb: number | null;
  today_used_mb: number | null;
  total_days: number;
  remaining_days: number | null;
  activated_at: string | null;
  expires_at: string | null;
  checked_at: string;
  daily_usage: { date: string; used_mb: number }[];
}
export type UsageResult = { status: 'ok'; data: UsageData } | { status: 'not_ready' | 'unsupported' };
export const number = (value: unknown): number | null =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value))
    ? Number(value)
    : null;
const round = (n: number) => Math.round(n * 100) / 100;
const bytes = (n: unknown) => round((number(n) ?? 0) / 1024 / 1024);
const unlimited = (gb: number) => gb < 0 || gb >= 999;
const day = (value: unknown) =>
  String(value ?? '')
    .replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    .slice(0, 10);
const iso = (value: unknown, offset?: string) => {
  if (value === null || value === undefined || value === '' || value === 0) return null;
  const text = String(value).trim();
  const date =
    typeof value === 'number'
      ? new Date(value)
      : new Date(offset && !/(Z|[+-]\d\d:?\d\d)$/.test(text) ? text.replace(' ', 'T') + offset : text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
function finish(u: any, now: Date): UsageData {
  const total = u.is_unlimited || u.total_mb === null ? null : round(u.total_mb);
  const used = round(Math.max(0, u.used_mb));
  const remaining = total === null ? null : round(Math.max(0, total - used));
  const remainingDays =
    u.remaining_days ??
    (u.activated && u.expires_at
      ? Math.max(0, Math.ceil((Date.parse(u.expires_at) - now.getTime()) / 86400000))
      : null);
  return {
    state:
      u.state ??
      (!u.activated
        ? 'not_activated'
        : u.expires_at && Date.parse(u.expires_at) <= now.getTime()
          ? 'expired'
          : remaining !== null && remaining <= 0
            ? 'depleted'
            : 'active'),
    is_unlimited: u.is_unlimited,
    total_mb: total,
    used_mb: used,
    remaining_mb: remaining,
    daily_quota_mb: u.daily_quota_mb ?? null,
    today_used_mb: u.today_used_mb ?? null,
    total_days: u.total_days ?? 0,
    remaining_days: u.activated ? remainingDays : null,
    activated_at: u.activated_at ?? null,
    expires_at: u.expires_at ?? null,
    checked_at: now.toISOString(),
    daily_usage: (u.daily_usage ?? [])
      .filter((r: any) => r.date)
      .sort((a: any, b: any) => a.date.localeCompare(b.date)),
  };
}
export function normalizeJoytel(response: any, tariff: any, now = new Date()): UsageData {
  if (!['0', '000'].includes(String(response?.code ?? response?.resultCode))) throw new Error('Joytel usage failed');
  const d = response.data;
  if (!d || number(d.totalUsage) === null || Number(d.totalUsage) < 0)
    throw new Error('Joytel usage has no valid counter');
  const activated = number(d.effTime) !== null && Number(d.effTime) > 0 ? iso(Number(d.effTime)) : null;
  const expires = number(d.expTime) !== null && Number(d.expTime) > 0 ? iso(Number(d.expTime)) : null;
  const gb = Number(tariff.quantity_internet ?? 0);
  return finish(
    {
      activated: !!activated,
      is_unlimited: unlimited(gb),
      total_mb: gb * 1024,
      used_mb: bytes(d.totalUsage),
      activated_at: activated,
      expires_at: expires,
      total_days:
        activated && expires
          ? Math.round((Date.parse(expires) - Date.parse(activated)) / 86400000)
          : tariff.validity_period,
      daily_usage: (d.dataUsageList ?? []).map((r: any) => ({ date: day(r.usageDate), used_mb: bytes(r.usage) })),
    },
    now,
  );
}
export function selectBcPlan(response: any, subOrderId?: string | null): any {
  if (String(response?.tradeCode) !== '1000') throw new Error('BillionConnect plan lookup failed');
  const plans = (Array.isArray(response.tradeData) ? response.tradeData : []).flatMap((o: any) => o.subOrderList ?? []);
  const plan =
    plans.find((p: any) => subOrderId && String(p.subOrderId) === subOrderId) ??
    plans.find((p: any) => String(p.planStatus) === '1') ??
    plans[0];
  if (!plan) throw new Error('BillionConnect returned no plan');
  return plan;
}
export function normalizeBc(planResponse: any, usageResponse: any, sim: any, now = new Date()): UsageData {
  const p = selectBcPlan(planResponse, sim.sub_order_id);
  const useOk = String(usageResponse?.tradeCode) === '1000';
  const usage = useOk
    ? usageResponse.tradeData?.subOrderList?.find((s: any) => String(s.subOrderId) === String(p.subOrderId))
    : null;
  if (number(p.usedTraffic) === null && (!usage || !Array.isArray(usage.usageInfoList)))
    throw new Error('BillionConnect returned no counter');
  const daily = (usage?.usageInfoList ?? []).map((r: any) => ({
    date: day(r.usedDate),
    used_mb: round((number(r.usageAmt) ?? 0) / 1024),
  }));
  const dailyKb = (usage?.usageInfoList ?? []).reduce((sum: number, r: any) => sum + (number(r.usageAmt) ?? 0), 0);
  const raw = number(p.totalTraffic),
    gb = Number(sim.tariff.quantity_internet ?? 0);
  const isUnlimited = raw !== null ? raw < 0 : unlimited(gb);
  const start = iso(p.planStartTime, '+08:00'),
    end = iso(p.planEndTime, '+08:00');
  const inUse = String(p.planStatus) === '1';
  return finish(
    {
      activated: inUse || !!start,
      is_unlimited: isUnlimited,
      total_mb: raw !== null ? raw / 1024 : gb * 1024,
      used_mb: Math.max(dailyKb, number(p.usedTraffic) ?? 0) / 1024,
      activated_at: start,
      expires_at: end,
      total_days: number(p.totalDays) ?? sim.tariff.validity_period,
      remaining_days: number(p.remainingDays) === null ? null : Math.max(0, Number(p.remainingDays)),
      state: !inUse && start ? (end && Date.parse(end) > now.getTime() ? 'depleted' : 'expired') : null,
      daily_usage: daily,
    },
    now,
  );
}
export function normalizeMobiline(d: any, sim: any, now = new Date()): UsageData {
  if (String(d.ICCID) !== sim.iccid) throw new Error('SkyBlue ICCID mismatch');
  const cdr = Array.isArray(d.cdr) ? d.cdr : [];
  const quota = number(d.quota),
    remain = number(d.remain_quota);
  const available = quota !== null && quota >= 0 && remain !== null && remain >= 0;
  const totalGb = available ? quota / 1024 ** 3 : (number(d.plan_quota) ?? Number(sim.tariff.quantity_internet ?? 0));
  const sum = cdr.reduce((n: number, r: any) => n + (number(r.bytes) ?? 0), 0);
  if (!(available && number(d.used_quota) !== null && Number(d.used_quota) >= 0) && !Array.isArray(d.cdr)) {
    throw new Error('SkyBlue returned no usage counters');
  }
  const start = iso(d.start_using_time, '+09:00'),
    end = iso(d.expire_time, '+09:00');
  const daily = cdr.map((r: any) => ({ date: day(r.date), used_mb: bytes(r.bytes) }));
  return finish(
    {
      activated: d.sim_activated === true || !!start,
      is_unlimited: unlimited(totalGb),
      total_mb: totalGb * 1024,
      used_mb: bytes(available && number(d.used_quota) !== null && Number(d.used_quota) >= 0 ? d.used_quota : sum),
      total_days: Number(d.plan_days) > 0 ? Number(d.plan_days) : sim.tariff.validity_period,
      activated_at: start,
      expires_at: end,
      daily_usage: daily,
      daily_quota_mb:
        d.daypass === true && number(d.daily_quota) !== null && Number(d.daily_quota) >= 0
          ? bytes(d.daily_quota)
          : null,
      today_used_mb:
        d.daypass === true
          ? daily
              .filter((r: any) => r.date === now.toISOString().slice(0, 10))
              .reduce((n: number, r: any) => n + r.used_mb, 0)
          : null,
    },
    now,
  );
}
