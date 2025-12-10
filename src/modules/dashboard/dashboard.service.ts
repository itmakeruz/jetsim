import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { OrderStatus } from '@prisma/client';
import { dateConverter } from 'src/common/helpers/date-converter.helper';
import { GetDashboardDto } from './dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: GetDashboardDto) {
    const dateFilter = dateConverter(query?.date);

    const whereSql = this.buildDateFilterSQL(dateFilter);

    const [totalOrders, activeOrders, totalRevenue, newClients, dailySales, topTariffs] = await Promise.all([
      this.prisma.order.count({
        where: {
          created_at: {
            gte: dateFilter?.startDate ?? undefined,
            lte: dateFilter?.endDate ?? undefined,
          },
        },
      }),

      this.prisma.order.count({
        where: {
          status: OrderStatus.COMPLETED,
          created_at: {
            gte: dateFilter?.startDate ?? undefined,
            lte: dateFilter?.endDate ?? undefined,
          },
        },
      }),

      this.prisma.$queryRawUnsafe<{ total: number }[]>(`
        SELECT COALESCE(SUM(t.price_sell), 0) AS total
        FROM sims s
        JOIN tariff t ON t.id = s.tariff_id
        ${whereSql}
      `),

      this.prisma.user.count({
        where: {
          created_at: {
            gte: dateFilter?.startDate ?? undefined,
            lte: dateFilter?.endDate ?? undefined,
          },
        },
      }),

      this.prisma.$queryRawUnsafe(`
        SELECT 
          DATE(s.created_at) AS day,
          SUM(t.price_sell) AS total
        FROM sims s
        JOIN tariff t ON t.id = s.tariff_id
        ${whereSql}
        GROUP BY 1
        ORDER BY 1
      `),

      this.prisma.sims.groupBy({
        by: ['tariff_id'],
        _count: { tariff_id: true },
        orderBy: { _count: { tariff_id: 'desc' } },
        take: 10,
        where: {
          created_at: {
            gte: dateFilter?.startDate ?? undefined,
            lte: dateFilter?.endDate ?? undefined,
          },
        },
      }),
    ]);

    return {
      success: true,
      message: '',
      data: {
        total_orders: totalOrders,
        active_orders: activeOrders,
        total_revenue: Number(totalRevenue[0]?.total ?? 0),
        new_clients: newClients,
        daily_sales: dailySales,
        top_tariffs: topTariffs,
      },
    };
  }

  private buildDateFilterSQL(dateFilter: { startDate?: Date; endDate?: Date }) {
    const conditions = [];

    if (dateFilter?.startDate) {
      conditions.push(`s.created_at >= '${dateFilter.startDate.toISOString()}'`);
    }

    if (dateFilter?.endDate) {
      conditions.push(`s.created_at <= '${dateFilter.endDate.toISOString()}'`);
    }

    if (!conditions.length) return '';

    return 'WHERE ' + conditions.join(' AND ');
  }
}
