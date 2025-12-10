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

    const start = dateFilter?.startDate ? `'${dateFilter.startDate.toISOString()}'` : 'NULL';

    const end = dateFilter?.endDate ? `'${dateFilter.endDate.toISOString()}'` : 'NULL';

    const dashboard = await this.prisma.$queryRawUnsafe<any[]>(`
 SELECT 
  -- 1. Total Orders
  (SELECT COUNT(*)::INT
   FROM "order" o
   WHERE 
     (:startDate IS NULL OR o.created_at >= :startDate)
     AND (:endDate IS NULL OR o.created_at <= :endDate)
  ) AS total_orders,

  -- 2. Active Orders
  (SELECT COUNT(*)::INT
   FROM "order" o
   WHERE o.status = 'COMPLETED'
     AND (:startDate IS NULL OR o.created_at >= :startDate)
     AND (:endDate IS NULL OR o.created_at <= :endDate)
  ) AS active_orders,

  -- 3. Total Revenue
  (SELECT COALESCE(SUM(t.price_sell)::FLOAT, 0)
   FROM sims s
   JOIN tariff t ON t.id = s.tariff_id
   WHERE
     (:startDate IS NULL OR s.created_at >= :startDate)
     AND (:endDate IS NULL OR s.created_at <= :endDate)
  ) AS total_revenue,

  -- 4. New clients
  (SELECT COUNT(*)::INT
   FROM "user" u
   WHERE
     (:startDate IS NULL OR u.created_at >= :startDate)
     AND (:endDate IS NULL OR u.created_at <= :endDate)
  ) AS new_clients,

  -- 5. Daily sales
  (
    SELECT json_agg(row_to_json(x))
    FROM (
      SELECT 
        DATE(s.created_at) AS day,
        SUM(t.price_sell)::FLOAT AS total
      FROM sims s
      JOIN tariff t ON t.id = s.tariff_id
      WHERE
        (:startDate IS NULL OR s.created_at >= :startDate)
        AND (:endDate IS NULL OR s.created_at <= :endDate)
      GROUP BY 1
      ORDER BY 1
    ) x
  ) AS daily_sales,

  -- 6. Top 10 tariffs
  (
    SELECT json_agg(row_to_json(y))
    FROM (
      SELECT 
        t.id,
        t.name_ru,
        COUNT(s.id)::INT AS sold
      FROM sims s
      JOIN tariff t ON t.id = s.tariff_id
      WHERE
        (:startDate IS NULL OR s.created_at >= :startDate)
        AND (:endDate IS NULL OR s.created_at <= :endDate)
      GROUP BY t.id, t.name_ru
      ORDER BY sold DESC
      LIMIT 10
    ) y
  ) AS top_tariffs;
`);
    return {
      success: true,
      message: '',
      data: dashboard,
    };
  }

  private buildDateFilterSQL(dateFilter: { startDate?: Date; endDate?: Date }) {
    const conditions: string[] = [];

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
