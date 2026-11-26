import { PartnerIds } from '../../../common/enums/partner.enum';

/**
 * Массовое создание тарифов из Excel (через партнёрку) и привязка их к компании.
 * Здесь только чистая логика: проверка строк и план действий. Запись в базу — в ResellersAdminService.
 */
export type ImportVerdict = 'CREATE' | 'ATTACH' | 'SKIP' | 'ERROR';

export interface ImportRow {
  sku_id: string;
  partner: string | number;
  name_ru: string;
  name_en: string;
  data_gb: number;
  validity_days: number;
  sms?: number;
  minutes?: number;
  is_4g?: boolean;
  is_5g?: boolean;
  region_group: string | number;
  kind?: 'local' | 'regional' | 'global';
  cost_rub: number;
  company_price: number;
}

export interface ImportContext {
  currency: string;
  partners: { id: number; name_ru: string; name_en: string; identified_number?: number | null }[];
  groups: { id: number; name_ru: string | null; name_en: string | null; regions: number }[];
  /** существующие (не удалённые) тарифы с теми же SKU */
  existing: { id: number; sku_id: string; partner_id: number; data_gb?: number | null; validity_days?: number | null }[];
  /** id тарифов, уже привязанных к этой компании */
  attached: Set<number>;
}

export interface PlannedRow {
  row: number;
  sku_id: string;
  verdict: ImportVerdict;
  message?: string;
  warnings: string[];
  tariff_id?: number;
  /** данные для создания (только CREATE) */
  create?: {
    partner_id: number;
    region_group_id: number;
    kind: 'local' | 'regional' | 'global';
    price_arrival: number;
  };
  /** цена компании в минорных единицах её валюты (CREATE и ATTACH) */
  price_kopecks?: number;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
export const toMinor = (v: number) => Math.round((v + Number.EPSILON) * 100);

function find<T extends { id: number }>(items: T[], ref: string | number, names: (t: T) => (string | null)[]): T | 'AMBIGUOUS' | undefined {
  const r = norm(ref);
  if (!r) return undefined;
  if (/^\d+$/.test(r)) {
    const byId = items.find((t) => t.id === Number(r));
    if (byId) return byId;
  }
  const byName = items.filter((t) => names(t).some((n) => norm(n) === r));
  if (byName.length > 1) return 'AMBIGUOUS';
  return byName[0];
}

/** Numeric references remain database IDs. Known aliases use provider routing codes,
 * never assume that a provider code is the primary key of its partner record. */
function findPartner(items: ImportContext['partners'], ref: string | number) {
  const r = norm(ref);
  if (!r) return undefined;
  if (/^\d+$/.test(r)) return find(items, ref, (p) => [p.name_ru, p.name_en]);
  const code = ['joy', 'jt', 'joytel'].includes(r) ? PartnerIds.JOYTEL : undefined;
  const matches = items.filter((p) =>
    [p.name_ru, p.name_en].some((name) => norm(name) === r) ||
    (code !== undefined && p.identified_number === code),
  );
  if (matches.length > 1) return 'AMBIGUOUS' as const;
  return matches[0];
}

const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export function planImport(rows: ImportRow[], ctx: ImportContext): PlannedRow[] {
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const row = i + 1;
    const sku = String(r.sku_id ?? '').trim();
    const out: PlannedRow = { row, sku_id: sku, verdict: 'ERROR', warnings: [] };
    const fail = (message: string): PlannedRow => ({ ...out, verdict: 'ERROR', message });

    if (!sku || sku.length > 100) return fail('Укажите SKU (до 100 символов)');
    if (!String(r.name_ru ?? '').trim() || !String(r.name_en ?? '').trim()) return fail('Укажите название на русском и английском');
    if (!integer(r.data_gb, 0, 100000)) return fail('Трафик (ГБ) должен быть целым числом');
    if (!integer(r.validity_days, 1, 3650)) return fail('Срок (дней) должен быть целым числом от 1');
    if (r.sms != null && !integer(r.sms, 0, 1_000_000)) return fail('SMS должно быть целым числом');
    if (r.minutes != null && !integer(r.minutes, 0, 1_000_000)) return fail('Минуты должны быть целым числом');
    if (typeof r.cost_rub !== 'number' || !Number.isFinite(r.cost_rub) || r.cost_rub < 0 || r.cost_rub > 10_000_000)
      return fail('Себестоимость должна быть числом не меньше 0');
    const priceKopecks = typeof r.company_price === 'number' && Number.isFinite(r.company_price) ? toMinor(r.company_price) : NaN;
    if (!Number.isSafeInteger(priceKopecks) || priceKopecks < 0 || priceKopecks > 1_000_000_000)
      return fail('Цена для компании должна быть числом не меньше 0');

    const partner = findPartner(ctx.partners, r.partner);
    if (partner === 'AMBIGUOUS') return fail('Несколько поставщиков с таким названием: укажите ID');
    if (!partner) return fail(`Поставщик «${r.partner}» не найден. Укажите ID записи поставщика или его точное название`);
    const group = find(ctx.groups, r.region_group, (g) => [g.name_ru, g.name_en]);
    if (group === 'AMBIGUOUS') return fail('Несколько групп регионов с таким названием: укажите ID');
    if (!group) return fail(`Группа регионов «${r.region_group}» не найдена`);
    if (group.regions === 0) return fail('В группе регионов нет стран');

    // SKU у поставщика один на объём трафика, а сроки разные: тариф определяют SKU + поставщик + ГБ + дни
    const dupKey = `${norm(sku)}|${partner.id}|${r.data_gb}|${r.validity_days}`;
    if (seen.has(dupKey)) return fail(`Повтор в файле: такая же строка уже есть (строка ${seen.get(dupKey)})`);
    seen.set(dupKey, row);

    const matches = ctx.existing.filter((t) => norm(t.sku_id) === norm(sku) && t.partner_id === partner.id && Number(t.data_gb) === r.data_gb && Number(t.validity_days) === r.validity_days);
    if (matches.length > 1) return fail('В центре несколько тарифов с таким SKU, поставщиком, трафиком и сроком: привяжите нужный вручную');

    const warnings: string[] = [];
    if (ctx.currency === 'RUB' && r.company_price < r.cost_rub) warnings.push('Цена для компании ниже себестоимости');
    out.warnings = warnings;
    out.price_kopecks = priceKopecks;

    if (matches.length === 1) {
      const t = matches[0];
      out.tariff_id = t.id;
      if (ctx.attached.has(t.id)) return { ...out, verdict: 'SKIP', message: 'Тариф уже привязан к компании, не изменён' };
      return { ...out, verdict: 'ATTACH', message: 'Тариф уже есть в центре: не меняем, только привязываем к компании' };
    }
    const kind = r.kind ?? (group.regions === 1 ? 'local' : 'regional');
    return {
      ...out,
      verdict: 'CREATE',
      create: { partner_id: partner.id, region_group_id: group.id, kind, price_arrival: toMinor(r.cost_rub) },
    };
  });
}

export function summarize(plan: PlannedRow[]) {
  const count = (v: ImportVerdict) => plan.filter((p) => p.verdict === v).length;
  return { create: count('CREATE'), attach: count('ATTACH'), skip: count('SKIP'), error: count('ERROR') };
}
