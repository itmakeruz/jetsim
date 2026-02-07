import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prisma';
import { dateConverter } from 'src/common/helpers/date-converter.helper';
import { GetDashboardDto } from './dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: GetDashboardDto) {
    const dateFilter = dateConverter(query?.date);
    const start: Date | null = dateFilter?.startDate ?? null;
    const end: Date | null = dateFilter?.endDate ?? null;

    const result = await this.prisma.$queryRaw<
      Array<{
        total_orders: number;
        active_orders: number;
        total_revenue: number;
        new_clients: number;
        daily_sales: unknown;
        top_tariffs: unknown;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::INT
         FROM "order" o
         WHERE (${start}::timestamptz IS NULL OR o.created_at >= ${start})
           AND (${end}::timestamptz IS NULL OR o.created_at <= ${end})
        ) AS total_orders,

        (SELECT COUNT(*)::INT
         FROM "order" o
         WHERE o.status = 'COMPLETED'
           AND (${start}::timestamptz IS NULL OR o.created_at >= ${start})
           AND (${end}::timestamptz IS NULL OR o.created_at <= ${end})
        ) AS active_orders,

        (SELECT COALESCE(SUM(t.price_sell)::FLOAT, 0)
         FROM sims s
         JOIN tariff t ON t.id = s.tariff_id
         WHERE (${start}::timestamptz IS NULL OR s.created_at >= ${start})
           AND (${end}::timestamptz IS NULL OR s.created_at <= ${end})
        ) AS total_revenue,

        (SELECT COUNT(*)::INT
         FROM "user" u
         WHERE (${start}::timestamptz IS NULL OR u.created_at >= ${start})
           AND (${end}::timestamptz IS NULL OR u.created_at <= ${end})
        ) AS new_clients,

        COALESCE(
          (SELECT json_agg(row_to_json(x))
           FROM (
             SELECT DATE(s.created_at) AS day,
                    SUM(t.price_sell)::FLOAT AS total
             FROM sims s
             JOIN tariff t ON t.id = s.tariff_id
             WHERE (${start}::timestamptz IS NULL OR s.created_at >= ${start})
               AND (${end}::timestamptz IS NULL OR s.created_at <= ${end})
             GROUP BY 1 ORDER BY 1
           ) x),
          '[]'::json
        ) AS daily_sales,

        COALESCE(
          (SELECT json_agg(row_to_json(y))
           FROM (
             SELECT t.id, t.name_ru,
                    COUNT(s.id)::INT AS sold
             FROM sims s
             JOIN tariff t ON t.id = s.tariff_id
             WHERE (${start}::timestamptz IS NULL OR s.created_at >= ${start})
               AND (${end}::timestamptz IS NULL OR s.created_at <= ${end})
             GROUP BY t.id, t.name_ru
             ORDER BY sold DESC
             LIMIT 10
           ) y),
          '[]'::json
        ) AS top_tariffs
    `);

    const row = result[0];
    return {
      success: true,
      message: '',
      data: {
        total_orders: Number(row?.total_orders ?? 0),
        active_orders: Number(row?.active_orders ?? 0),
        total_revenue: Number(row?.total_revenue ? row?.total_revenue / 100 : 0),
        new_clients: Number(row?.new_clients ?? 0),
        daily_sales: row?.daily_sales ?? [],
        top_tariffs: row?.top_tariffs ?? [],
      },
    };
  }
}
