import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { toNumber } from '../ledger/money';

/** Каталог глазами партнёра: тарифы компании с её закупочными ценами и версиями цен. Без sku, поставщика и нашей себестоимости. */
@Injectable()
export class B2bCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(resellerId: number) {
    const rows = await this.prisma.resellerTariff.findMany({
      where: { reseller_id: resellerId, active: true, tariff: { deleted_at: null, status: 'ACTIVE' } },
      orderBy: { tariff_id: 'asc' },
      include: {
        reseller: { select: { currency: true } },
        tariff: { include: { regions: { select: { id: true, name_ru: true, name_en: true, iso_code: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.tariff_id,
      name_ru: r.tariff.name_ru,
      name_en: r.tariff.name_en,
      data_gb: r.tariff.quantity_internet,
      validity_days: r.tariff.validity_period,
      is_4g: r.tariff.is_4g,
      is_5g: r.tariff.is_5g,
      regions: r.tariff.regions,
      price_kopecks: toNumber(r.price_kopecks),
      price_version: r.price_version,
      currency: r.reseller.currency,
    }));
  }
  async snapshot(resellerId: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const company = await tx.reseller.findUniqueOrThrow({
          where: { id: resellerId },
          select: { id: true, currency: true, status: true },
        });
        const rows = await tx.resellerTariff.findMany({
          where: { reseller_id: resellerId, active: true, tariff: { deleted_at: null, status: 'ACTIVE' } },
          orderBy: { tariff_id: 'asc' },
          include: {
            tariff: { include: { partner: true, regions: true, region_group: { include: { regions: true } } } },
          },
        });
        const regions = new Map<number, any>();
        const groups = new Map<number, any>();
        const photo = (value: string | null, folder: string) =>
          value && !/[\\/\x00-\x1f?#]/.test(value) && value !== '.' && value !== '..'
            ? `https://api.jetsim.ru/uploads/${folder}/${encodeURIComponent(value)}`
            : null;
        const country = (r: any) => ({
          id: r.id,
          name_ru: r.name_ru,
          name_en: r.name_en,
          iso_code: r.iso_code,
          status: r.status,
          image: photo(r.image, 'region_icons'),
          cover_image: photo(r.cover_image, 'region_icons'),
        });
        const tariffs = rows.map((r) => {
          const t = r.tariff,
            g = t.region_group;
          t.regions.forEach((v) => regions.set(v.id, country(v)));
          if (g) {
            g.regions.forEach((v) => regions.set(v.id, country(v)));
            groups.set(g.id, {
              id: g.id,
              name_ru: g.name_ru,
              name_en: g.name_en,
              status: g.status,
              region_ids: g.regions.map((v) => v.id).sort((a, b) => a - b),
              image: photo(g.image, 'region_group_icons'),
              cover_image: photo(g.cover_image, 'region_group_icons'),
            });
          }
          return {
            id: t.id,
            name_ru: t.name_ru,
            name_en: t.name_en,
            data_gb: t.quantity_internet,
            sms: t.quantity_sms,
            minutes: t.quantity_minute,
            validity_days: t.validity_period,
            is_4g: t.is_4g,
            is_5g: t.is_5g,
            is_local: t.is_local,
            is_regional: t.is_regional,
            is_global: t.is_global,
            region_ids: t.regions.map((v) => v.id).sort((a, b) => a - b),
            group_id: g?.id ?? null,
            available:
              company.status === 'ACTIVE' &&
              t.partner.status === 'ACTIVE' &&
              [1, 2, 3].includes(t.partner.identified_number ?? 0),
            price_kopecks: toNumber(r.price_kopecks),
            price_version: r.price_version,
            currency: company.currency,
            offer_version: `${t.offer_revision}:${r.offer_revision}`,
          };
        });
        return {
          schema_version: 1,
          complete: true,
          company,
          regions: [...regions.values()],
          region_groups: [...groups.values()],
          tariffs,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
