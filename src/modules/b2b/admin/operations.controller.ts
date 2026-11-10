import { providerHealth } from '../../../http/provider-health';
import { Body, ConflictException, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '@prisma';
import { Prisma } from '@prisma/client';
import { ManagementKeyGuard } from '../guards/management-key.guard';
class PeriodDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) reseller_id?: number;
}
class PriceItem {
  @IsInt() @Min(1) tariff_id: number;
  @IsInt() @Min(1) price_version: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) price_kopecks: number;
}
class BulkPrices {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PriceItem) items: PriceItem[];
}
@Controller('b2b-admin/operations')
@UseGuards(ManagementKeyGuard)
export class OperationsController {
  constructor(private readonly db: PrismaService) {}
  private filter(q: PeriodDto): Prisma.ResellerOrderWhereInput {
    return { ...(q.reseller_id ? { reseller_id: q.reseller_id } : {}), created_at: { gte: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400_000), ...(q.to ? { lte: new Date(q.to) } : {}) } };
  }
  @Get('overview') async overview(@Query() q: PeriodDto) {
    const where = this.filter(q);
    const groups = await this.db.resellerOrder.groupBy({ by: ['currency', 'state', 'cost_currency'], where, _count: { _all: true, cost_kopecks: true }, _sum: { price_kopecks: true, cost_kopecks: true } });
    const rows = groups.map(r => ({ currency: r.currency, state: r.state, count: r._count._all, known_cost_count: r._count.cost_kopecks, sales_kopecks: Number(r._sum.price_kopecks ?? 0), cost_currency: r.cost_currency, cost_kopecks: r._sum.cost_kopecks == null ? null : Number(r._sum.cost_kopecks), margin_kopecks: r.cost_currency === r.currency && r._count.cost_kopecks === r._count._all ? Number((r._sum.price_kopecks ?? 0n) - (r._sum.cost_kopecks ?? 0n)) : null }));
    const active = await this.db.resellerOrder.groupBy({ by: ['reseller_id'], where });
    return { rows, active_partners: active.length, checked_at: new Date() };
  }
  @Get('providers') async providers(@Query() q: PeriodDto) {
    const groups = await this.db.resellerOrder.groupBy({ by: ['provider_name', 'state'], where: this.filter(q), _count: { _all: true }, _max: { issued_at: true, failed_at: true } });
    const latency = await this.db.$queryRaw<Array<{ provider: string | null; avg_seconds: number | null }>>(Prisma.sql`SELECT provider_name AS provider, AVG(GREATEST(0, EXTRACT(EPOCH FROM (issued_at - submitted_at))))::float8 AS avg_seconds FROM reseller_order WHERE issued_at IS NOT NULL AND submitted_at IS NOT NULL AND created_at >= ${q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400_000)} AND created_at <= ${q.to ? new Date(q.to) : new Date()} ${q.reseller_id ? Prisma.sql`AND reseller_id = ${q.reseller_id}` : Prisma.empty} GROUP BY provider_name`);
    return { observations: providerHealth(), rows: groups.map(g => ({ failure_rate_percent: groups.filter(x => x.provider_name === g.provider_name && x.state === 'FAILED').reduce((n, x) => n + x._count._all, 0) * 100 / groups.filter(x => x.provider_name === g.provider_name).reduce((n, x) => n + x._count._all, 0), provider: g.provider_name ?? 'Нет исторических данных', state: g.state, count: g._count._all, last_issued_at: g._max.issued_at, last_failed_at: g._max.failed_at, avg_issue_seconds: latency.find(l => l.provider === g.provider_name)?.avg_seconds ?? null, balance: null, api_availability: 'unknown' })), checked_at: new Date() };
  }
  @Get('ledger') async ledger(@Query() q: PeriodDto) {
    // Ограничение явно сообщается; экспорт не притворяется полной выборкой при превышении.
    const where: Prisma.ResellerLedgerWhereInput = { ...(q.reseller_id ? { reseller_id: q.reseller_id } : {}), created_at: { gte: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400_000), ...(q.to ? { lte: new Date(q.to) } : {}) } };
    const total = await this.db.resellerLedger.count({ where });
    const rows = await this.db.resellerLedger.findMany({ where, orderBy: { id: 'desc' }, take: 10000, include: { reseller: { select: { currency: true } } } });
    return { total, truncated: total > 10000, data: rows.map(r => ({ ...r, currency: r.reseller.currency, reseller: undefined, delta_balance_kopecks: Number(r.delta_balance_kopecks), delta_reserved_kopecks: Number(r.delta_reserved_kopecks), balance_after: Number(r.balance_after), reserved_after: Number(r.reserved_after) })) };
  }
  @Post('resellers/:id/prices') async prices(@Param('id', ParseIntPipe) id: number, @Body() dto: BulkPrices) {
    if (new Set(dto.items.map(i => i.tariff_id)).size !== dto.items.length) throw new ConflictException('Повторяющиеся тарифы');
    return this.db.$transaction(async tx => {
      for (const item of dto.items) {
        const result = await tx.resellerTariff.updateMany({ where: { reseller_id: id, tariff_id: item.tariff_id, price_version: item.price_version }, data: { price_kopecks: BigInt(item.price_kopecks), price_version: { increment: 1 } } });
        if (!result.count) throw new ConflictException('Цена изменилась: обновите предварительный просмотр');
      }
      return { updated: dto.items.length };
    });
  }
}
