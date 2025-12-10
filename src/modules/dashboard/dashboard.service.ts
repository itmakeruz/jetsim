import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { OrderStatus, Status } from '@prisma/client';
import { dateConverter } from 'src/common/helpers/date-converter.helper';
import { GetDashboardDto } from './dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: GetDashboardDto) {
    const dateFilter = dateConverter(query?.date);

    const whereDate =
      dateFilter.startDate && dateFilter.endDate
        ? {
            created_at: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          }
        : {};

    const [totalOrders, activeOrders, totalRevenue, newClients, dailySales, topTariffs] = await Promise.all([
      this.prisma.order.count({
        where: whereDate,
      }),

      this.prisma.order.count({
        where: {
          status: OrderStatus.COMPLETED,
          ...whereDate,
        },
      }),

      this.prisma.sims.aggregate({
        _sum: {},
        where: whereDate,
      }),

      this.prisma.user.count({
        where: whereDate,
      }),

      this.prisma.$queryRaw`
      SELECT 
        DATE(s.created_at) AS day,
        SUM(t.price_sell) AS total
      FROM sims s
      JOIN tariff t ON t.id = s.tariff_id
      WHERE 
        (${dateFilter.startDate} IS NULL OR s.created_at >= ${dateFilter.startDate})
        AND (${dateFilter.endDate} IS NULL OR s.created_at <= ${dateFilter.endDate})
      GROUP BY 1
      ORDER BY 1
    `,

      this.prisma.sims.groupBy({
        by: ['tariff_id'],
        _count: { tariff_id: true },
        orderBy: { _count: { tariff_id: 'desc' } },
        take: 10,
        where: whereDate,
      }),
    ]);

    return {
      success: true,
      message: '',
      data: {
        total_orders: totalOrders,
        active_orders: activeOrders,
        total_revenue: totalRevenue._sum ?? 0,
        new_clients: newClients,
        daily_sales: dailySales,
        top_tariffs: topTariffs,
      },
    };
  }
}
