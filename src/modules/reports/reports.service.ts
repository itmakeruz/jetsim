import { Injectable } from '@nestjs/common';
import { Prisma, SimStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '@prisma';
import { dateConverter, generateExcel, paginate, ExcelColumn } from '@helpers';
import { GetSalesReportDto } from './dto';

/** Максимум строк в одной выгрузке — чтобы отчёт за большой период не съел память */
const EXCEL_ROW_LIMIT = 50_000;

const EXCEL_COLUMNS: ExcelColumn[] = [
  { header: 'ID eSIM', key: 'id', width: 10 },
  { header: 'Дата', key: 'date', width: 20 },
  { header: 'ICCID', key: 'iccid', width: 24 },
  { header: 'Тариф', key: 'tariff', width: 30 },
  { header: 'Объём, ГБ', key: 'internet', width: 12 },
  { header: 'Кем куплено', key: 'buyer', width: 32 },
  { header: 'Сумма, ₽', key: 'amount', width: 14 },
  { header: 'Статус', key: 'status', width: 18 },
];

const ACTIVATION_LABELS: Record<string, string> = {
  ACTIVATED: 'Активирована',
  EXPIRED: 'Использована',
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSales(query: GetSalesReportDto) {
    const where = this.buildWhere(query);

    const [{ data, meta }, summary] = await Promise.all([
      paginate('sims', {
        page: query?.page,
        size: query?.size,
        where,
        select: this.getSelect(),
      }),
      this.buildSummary(where),
    ]);

    return {
      success: true,
      message: '',
      data: (data as any[]).map((sim) => this.mapRow(sim)),
      summary,
      meta,
    };
  }

  /**
   * Итоги считаем по тем же фильтрам, что и таблицу.
   * Выручку берём через группировку по тарифам, а не выгрузкой всех строк:
   * тарифов десятки, а проданных eSIM — десятки тысяч.
   */
  private async buildSummary(where: Prisma.SimsWhereInput) {
    const [byTariff, byStatus] = await Promise.all([
      this.prisma.sims.groupBy({ by: ['tariff_id'], where, _count: { _all: true } }),
      this.prisma.sims.groupBy({ by: ['sim_status'], where, _count: { _all: true } }),
    ]);

    const tariffIds = byTariff.map((row) => row.tariff_id).filter((id): id is number => id !== null);

    const tariffs = tariffIds.length
      ? await this.prisma.tariff.findMany({
          where: { id: { in: tariffIds } },
          select: { id: true, price_sell: true },
        })
      : [];

    const priceById = new Map(tariffs.map((t) => [t.id, t.price_sell ?? 0]));

    const totalKopecks = byTariff.reduce(
      (sum, row) => sum + (priceById.get(row.tariff_id as number) ?? 0) * row._count._all,
      0,
    );

    const countBy = (status: SimStatus | null) =>
      byStatus.find((row) => row.sim_status === status)?._count._all ?? 0;

    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);

    return {
      total_count: total,
      total_amount: totalKopecks / 100,
      average_amount: total > 0 ? Math.round(totalKopecks / total) / 100 : 0,
      activated: countBy(SimStatus.ACTIVATED),
      expired: countBy(SimStatus.EXPIRED),
      not_activated: countBy(null),
    };
  }

  async getSalesExcel(query: GetSalesReportDto) {
    const sims = await this.prisma.sims.findMany({
      where: this.buildWhere(query),
      select: this.getSelect(),
      orderBy: { created_at: 'desc' },
      take: EXCEL_ROW_LIMIT,
    });

    const rows = sims.map((sim) => {
      const row = this.mapRow(sim);

      return {
        id: row.id,
        date: row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '',
        iccid: row.iccid ?? '—',
        tariff: row.tariff_name,
        internet: row.quantity_internet,
        buyer: row.buyer_name ? `${row.buyer_name} (${row.buyer_email ?? '—'})` : (row.buyer_email ?? '—'),
        amount: row.amount,
        status: row.activation_label,
      };
    });

    return generateExcel(rows, EXCEL_COLUMNS, 'Продажи');
  }

  private buildWhere(query: GetSalesReportDto): Prisma.SimsWhereInput {
    // В отчёт попадают только оплаченные eSIM. Дашборд этого не делает и потому
    // завышает выручку на брошенные корзины — здесь эту ошибку не повторяем.
    const where: Prisma.SimsWhereInput = {
      order: {
        transactions: { some: { status: TransactionStatus.SUCCESS } },
      },
    };

    const { startDate, endDate } = dateConverter(query?.date);
    if (startDate && endDate) {
      where.created_at = { gte: startDate, lte: endDate };
    }

    // Фильтры тарифа складываем в один объект: несколько присваиваний
    // where.tariff перетёрли бы друг друга
    const tariffFilter: Prisma.TariffWhereInput = {};

    const tariff = query?.tariff?.trim();
    if (tariff) {
      tariffFilter.OR = [
        { name_ru: { contains: tariff, mode: 'insensitive' } },
        { name_en: { contains: tariff, mode: 'insensitive' } },
      ];
    }

    if (query?.internet !== undefined) {
      tariffFilter.quantity_internet = query.internet;
    }

    // В отчёте сумма показывается в рублях, а price_sell хранится в копейках
    const priceFilter: Prisma.IntNullableFilter = {};
    if (query?.amount_from !== undefined) {
      priceFilter.gte = Math.round(query.amount_from * 100);
    }
    if (query?.amount_to !== undefined) {
      priceFilter.lte = Math.round(query.amount_to * 100);
    }
    if (Object.keys(priceFilter).length > 0) {
      tariffFilter.price_sell = priceFilter;
    }

    if (Object.keys(tariffFilter).length > 0) {
      where.tariff = tariffFilter;
    }

    const buyer = query?.buyer?.trim();
    if (buyer) {
      where.user = {
        OR: [
          { name: { contains: buyer, mode: 'insensitive' } },
          { email: { contains: buyer, mode: 'insensitive' } },
        ],
      };
    }

    const iccid = query?.iccid?.trim();
    if (iccid) {
      where.iccid = { contains: iccid, mode: 'insensitive' };
    }

    if (query?.sim_status) {
      where.sim_status = query.sim_status;
    }

    const search = query?.search?.trim();
    if (search) {
      where.OR = [
        { tariff: { name_ru: { contains: search, mode: 'insensitive' } } },
        { tariff: { name_en: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private getSelect(): Prisma.SimsSelect {
    return {
      id: true,
      iccid: true,
      status: true,
      sim_status: true,
      created_at: true,
      user: { select: { id: true, name: true, email: true } },
      tariff: { select: { id: true, name_ru: true, name_en: true, quantity_internet: true, price_sell: true } },
    };
  }

  private mapRow(sim: any) {
    return {
      id: sim?.id,
      iccid: sim?.iccid ?? null,
      created_at: sim?.created_at,
      tariff_name: sim?.tariff?.name_ru || sim?.tariff?.name_en || '—',
      quantity_internet: sim?.tariff?.quantity_internet ?? 0,
      buyer_name: sim?.user?.name ?? null,
      buyer_email: sim?.user?.email ?? null,
      amount: sim?.tariff?.price_sell ? sim.tariff.price_sell / 100 : 0,
      status: sim?.status,
      sim_status: sim?.sim_status,
      activation_label: ACTIVATION_LABELS[sim?.sim_status] ?? 'Не активирована',
    };
  }
}
