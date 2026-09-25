import { Injectable } from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '@prisma';
import { dateConverter, generateExcel, paginate, ExcelColumn } from '@helpers';
import { GetSalesReportDto } from './dto';

/** Максимум строк в одной выгрузке — чтобы отчёт за большой период не съел память */
const EXCEL_ROW_LIMIT = 50_000;

const EXCEL_COLUMNS: ExcelColumn[] = [
  { header: 'ID eSIM', key: 'id', width: 10 },
  { header: 'Дата', key: 'date', width: 20 },
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
    const { data, meta } = await paginate('sims', {
      page: query?.page,
      size: query?.size,
      where: this.buildWhere(query),
      select: this.getSelect(),
    });

    return {
      success: true,
      message: '',
      data: (data as any[]).map((sim) => this.mapRow(sim)),
      meta,
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
