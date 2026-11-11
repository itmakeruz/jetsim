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
      include: { reseller: { select: { currency: true } }, tariff: { include: { regions: { select: { id: true, name_ru: true, name_en: true, iso_code: true } } } } },
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
}
