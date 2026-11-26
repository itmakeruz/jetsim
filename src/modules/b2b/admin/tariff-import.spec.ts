import { ImportContext, ImportRow, planImport, summarize } from './tariff-import';

const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
  currency: 'RUB',
  partners: [
    { id: 1, name_ru: 'Джойтел', name_en: 'Joytel' },
    { id: 2, name_ru: 'Скайблю', name_en: 'SkyBlue' },
  ],
  groups: [
    { id: 10, name_ru: 'Япония', name_en: 'Japan', regions: 1 },
    { id: 11, name_ru: 'Европа', name_en: 'Europe', regions: 30 },
    { id: 12, name_ru: 'Пустая', name_en: 'Empty', regions: 0 },
  ],
  existing: [],
  attached: new Set<number>(),
  ...over,
});
const row = (over: Partial<ImportRow> = {}): ImportRow => ({
  sku_id: 'JP-5G-30',
  partner: 'Joytel',
  name_ru: 'Япония 5 ГБ',
  name_en: 'Japan 5 GB',
  data_gb: 5,
  validity_days: 30,
  region_group: 'Япония',
  cost_rub: 300,
  company_price: 450.5,
  ...over,
});

describe('planImport', () => {
  it('plans a new tariff: kopecks, supplier and group by name, local for a single-country group', () => {
    const [p] = planImport([row()], ctx());
    expect(p).toMatchObject({ row: 1, verdict: 'CREATE', price_kopecks: 45050 });
    expect(p.create).toEqual({ partner_id: 1, region_group_id: 10, kind: 'local', price_arrival: 30000 });
  });

  it('resolves supplier and group by id and picks regional for multi-country groups', () => {
    const [p] = planImport([row({ partner: 2, region_group: '11' })], ctx());
    expect(p.create).toMatchObject({ partner_id: 2, region_group_id: 11, kind: 'regional' });
    expect(planImport([row({ kind: 'global', region_group: 'Europe' })], ctx())[0].create?.kind).toBe('global');
  });

  it('attaches an existing tariff without changing it and skips one already attached', () => {
    const existing = [{ id: 77, sku_id: 'jp-5g-30', partner_id: 1, data_gb: 5, validity_days: 30 }];
    expect(planImport([row()], ctx({ existing }))[0]).toMatchObject({ verdict: 'ATTACH', tariff_id: 77, price_kopecks: 45050 });
    expect(planImport([row()], ctx({ existing, attached: new Set([77]) }))[0]).toMatchObject({ verdict: 'SKIP', tariff_id: 77 });
  });

  it('allows the same SKU with different days or GB, still rejects a true duplicate', () => {
    const plan = planImport(
      [row({ validity_days: 7 }), row({ validity_days: 15 }), row({ validity_days: 30 }), row({ validity_days: 30 }), row({ data_gb: 10, validity_days: 30 })],
      ctx(),
    );
    expect(plan.map((p) => p.verdict)).toEqual(['CREATE', 'CREATE', 'CREATE', 'ERROR', 'CREATE']);
  });

  it('attaches only the existing tariff with the same days', () => {
    const existing = [
      { id: 1, sku_id: 'jp-5g-30', partner_id: 1, data_gb: 5, validity_days: 7 },
      { id: 2, sku_id: 'jp-5g-30', partner_id: 1, data_gb: 5, validity_days: 30 },
    ];
    expect(planImport([row({ validity_days: 7 }), row({ validity_days: 15 })], ctx({ existing })).map((p) => [p.verdict, p.tariff_id])).toEqual([['ATTACH', 1], ['CREATE', undefined]]);
  });

  it('reports per-row errors: unknown supplier/group, bad numbers, empty group, duplicates, ambiguous existing', () => {
    const plan = planImport(
      [
        row({ partner: 'Nope' }),
        row({ sku_id: 'A', region_group: 'Нет такой' }),
        row({ sku_id: 'B', data_gb: 1.5 }),
        row({ sku_id: 'C', company_price: -1 }),
        row({ sku_id: 'D', region_group: 'Пустая' }),
        row({ sku_id: 'E' }),
        row({ sku_id: 'e' }),
        row({ sku_id: 'F' }),
      ],
      ctx({ existing: [{ id: 1, sku_id: 'F', partner_id: 1, data_gb: 5, validity_days: 30 }, { id: 2, sku_id: 'F', partner_id: 1, data_gb: 5, validity_days: 30 }] }),
    );
    expect(plan.map((p) => p.verdict)).toEqual(['ERROR', 'ERROR', 'ERROR', 'ERROR', 'ERROR', 'CREATE', 'ERROR', 'ERROR']);
    expect(plan[6].message).toContain('строка 6');
    expect(summarize(plan)).toEqual({ create: 1, attach: 0, skip: 0, error: 7 });
  });

  it('warns when the company price is below cost only for RUB companies', () => {
    expect(planImport([row({ company_price: 100 })], ctx())[0].warnings).toContain('Цена для компании ниже себестоимости');
    expect(planImport([row({ company_price: 100 })], ctx({ currency: 'USD' }))[0].warnings).toEqual([]);
  });

  it('rounds prices to whole minor units without float drift', () => {
    expect(planImport([row({ company_price: 1.15, cost_rub: 0.07 })], ctx())[0]).toMatchObject({ price_kopecks: 115 });
  });
});

describe('Joytel supplier aliases', () => {
  const partners = [{ id: 42, name_ru: 'Поставщик eSIM', name_en: 'Travel provider', identified_number: 1 }];
  it.each(['JOY', 'JT', 'Joytel', 'joytel', '  JoyTel  '])('resolves %s through provider code, preserving the real foreign key', (partner) => {
    const [p] = planImport([row({ partner })], ctx({ partners }));
    expect(p.create?.partner_id).toBe(42);
    expect(p.verdict).toBe('CREATE');
  });
  it('numeric references remain partner record IDs, not routing codes', () => {
    expect(planImport([row({ partner: '42' })], ctx({ partners }))[0].create?.partner_id).toBe(42);
    expect(planImport([row({ partner: 1 })], ctx({ partners }))[0].verdict).toBe('ERROR');
  });
  it('does not invent a Joytel provider when none is configured', () => {
    expect(planImport([row({ partner: 'JT' })], ctx({ partners: [{ ...partners[0], identified_number: 2 }] }))[0].verdict).toBe('ERROR');
  });
  it('rejects duplicate routing records and conflicting exact names instead of choosing arbitrarily', () => {
    for (const extra of [{ ...partners[0], id: 43 }, { id: 43, name_ru: 'Joytel', name_en: 'Other', identified_number: 2 }]) {
      expect(planImport([row()], ctx({ partners: [...partners, extra] }))[0].message).toContain('укажите ID');
    }
  });
  it('detects repeated SKU across different aliases of the same provider', () => {
    const plan = planImport([row({partner:'JT'}), row({partner:'Joytel'})], ctx({partners}));
    expect(plan.map(p=>p.verdict)).toEqual(['CREATE','ERROR']);
    expect(plan[1].message).toContain('Повтор в файле');
  });
});
