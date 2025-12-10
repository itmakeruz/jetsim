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

    const [totalOrders, activeOrders, totalRevenue, newClients, dailySales, topTariffs] = await Promise.all([
      // 1. Jami buyurtmalar
      this.prisma.order.count({
        where: {
          created_at: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),

      // 2. Aktiv buyurtmalar
      this.prisma.order.count({
        where: {
          status: OrderStatus.COMPLETED,
          created_at: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),

      // 3. Total revenue
      this.prisma.sims.aggregate({
        _sum: {
          /* example: price_sell */
        },
        where: {
          created_at: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),

      // 4. Yangi klientlar
      this.prisma.user.count({
        where: {
          created_at: {
            gte: dateFilter.startDate,
            lte: dateFilter.endDate,
          },
        },
      }),

      // 5. Daily sales
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

      // 6. Top tarifs
      this.prisma.sims.groupBy({
        by: ['tariff_id'],
        _count: {
          tariff_id: true,
        },
        orderBy: {
          _count: {
            tariff_id: 'desc',
          },
        },
        take: 10,
        where: {
          ...(dateFilter.startDate && {
            created_at: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          }),
        },
      }),
    ]);

    return {
      totalOrders,
      activeOrders,
      totalRevenue: totalRevenue._sum ?? 0,
      newClients,
      dailySales,
      topTariffs,
    };
  }
}
