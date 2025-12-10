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
    (SELECT COUNT(*) FROM "order" o
     WHERE (${start} IS NULL OR o.created_at >= ${start})
       AND (${end} IS NULL OR o.created_at <= ${end})
    ) AS total_orders,

    (SELECT COUNT(*) FROM "order" o
     WHERE o.status = 'ACTIVE'
       AND (${start} IS NULL OR o.created_at >= ${start})
       AND (${end} IS NULL OR o.created_at <= ${end})
    ) AS active_orders,

    (SELECT COALESCE(CAST(SUM(t.price_sell) AS FLOAT), 0)
     FROM sims s
     JOIN tariff t ON t.id = s.tariff_id
     WHERE (${start} IS NULL OR s.created_at >= ${start})
       AND (${end} IS NULL OR s.created_at <= ${end})
    ) AS total_revenue,

    (SELECT COUNT(*) FROM "user" u
     WHERE (${start} IS NULL OR u.created_at >= ${start})
       AND (${end} IS NULL OR u.created_at <= ${end})
    ) AS new_clients,

    (
      SELECT json_agg(row_to_json(x))
      FROM (
        SELECT DATE(s.created_at) AS day,
               CAST(SUM(t.price_sell) AS FLOAT) AS total
        FROM sims s
        JOIN tariff t ON t.id = s.tariff_id
        WHERE (${start} IS NULL OR s.created_at >= ${start})
          AND (${end} IS NULL OR s.created_at <= ${end})
        GROUP BY 1 ORDER BY 1
      ) x
    ) AS daily_sales,

    (
      SELECT json_agg(row_to_json(y))
      FROM (
        SELECT t.id, t.name_ru, COUNT(s.id)::INT AS sold
        FROM sims s
        JOIN tariff t ON t.id = s.tariff_id
        WHERE (${start} IS NULL OR s.created_at >= ${start})
          AND (${end} IS NULL OR s.created_at <= ${end})
        GROUP BY t.id, t.name_ru
        ORDER BY sold DESC
        LIMIT 10
      ) y
    ) AS top_tariffs
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
