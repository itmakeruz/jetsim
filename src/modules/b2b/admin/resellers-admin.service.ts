import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@prisma';
import { randomUUID } from 'crypto';
import { generateKey } from '../keys/key-codec';
import { parseKopecks, toNumber } from '../ledger/money';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { presentBalance, presentLedgerEntry, presentReseller } from '../presenters';
import { CreateResellerDto, ImportTariffsDto, MoneyOperationDto, PageQueryDto, ResellerTariffsQueryDto, UpdateResellerDto, UpsertResellerTariffDto } from './dto/admin.dto';
import { ImportRow, PlannedRow, planImport, summarize } from './tariff-import';

/** Управляющие операции суперадмина над партнёрскими компаниями (вызывает только наш партнёрский backend). */
@Injectable()
export class ResellersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: ResellerLedgerService,
  ) {}

  // ---------------------------------------------------------------- компании

  async createReseller(dto: CreateResellerDto) {
    const reseller = await this.prisma.$transaction(async (tx) => {
      // Служебный пользователь держит eSIM компании; войти им нельзя (нет пароля/телефона/email)
      const user = await tx.user.create({ data: { name: dto.name, is_service: true, is_verified: true } });
      return tx.reseller.create({
        data: { name: dto.name.trim(), currency: dto.currency ?? 'RUB', service_user_id: user.id, account: { create: {} } },
      });
    });
    return presentReseller(reseller, await this.ledger.getBalance(reseller.id));
  }

  async listResellers() {
    const rows = await this.prisma.reseller.findMany({ orderBy: { id: 'asc' }, include: { account: true } });
    return rows.map((r) =>
      presentReseller(
        r,
        r.account
          ? {
              balance: r.account.balance_kopecks,
              reserved: r.account.reserved_kopecks,
              available: r.account.balance_kopecks - r.account.reserved_kopecks,
            }
          : undefined,
      ),
    );
  }

  async getReseller(id: number) {
    const reseller = await this.requireReseller(id);
    return presentReseller(reseller, await this.ledger.getBalance(id));
  }

  async updateReseller(id: number, dto: UpdateResellerDto) {
    await this.requireReseller(id);
    const reseller = await this.prisma.reseller.update({
      where: { id },
      data: { ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.status ? { status: dto.status } : {}) },
    });
    return presentReseller(reseller, await this.ledger.getBalance(id));
  }

  // ----------------------------------------------------------------- ключи

  /** Значение ключа возвращается ровно один раз — потом доступен только prefix. */
  async issueKey(resellerId: number, name?: string) {
    await this.requireReseller(resellerId);
    const { key, prefix, hash } = generateKey();
    const row = await this.prisma.resellerApiKey.create({
      data: { reseller_id: resellerId, name: name ?? null, prefix, key_hash: hash },
    });
    return { id: row.id, prefix, name: row.name, key, created_at: row.created_at };
  }

  async listKeys(resellerId: number) {
    await this.requireReseller(resellerId);
    const rows = await this.prisma.resellerApiKey.findMany({
      where: { reseller_id: resellerId },
      orderBy: { id: 'desc' },
    });
    return rows.map((k) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      status: k.status,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
      created_at: k.created_at,
    }));
  }

  async revokeKey(resellerId: number, keyId: number) {
    const res = await this.prisma.resellerApiKey.updateMany({
      where: { id: keyId, reseller_id: resellerId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revoked_at: new Date() },
    });
    if (res.count === 0) {
      const exists = await this.prisma.resellerApiKey.findFirst({ where: { id: keyId, reseller_id: resellerId } });
      if (!exists) throw new NotFoundException('Ключ не найден');
    }
    return { revoked: true };
  }

  // ---------------------------------------------------------------- тарифы

  /** Каталог центрального JetSim для выбора тарифов суперадмином (с нашей себестоимостью — партнёрам её не показываем). */
  async listCentralTariffs(q: PageQueryDto) {
    const page = q.page ?? 1;
    const size = q.size ?? 50;
    const search = q.search?.trim();
    const where: Prisma.TariffWhereInput = {
      deleted_at: null,
      ...(search
        ? {
            OR: [
              { name_ru: { contains: search, mode: 'insensitive' } },
              { name_en: { contains: search, mode: 'insensitive' } },
              { sku_id: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.tariff.count({ where }),
      this.prisma.tariff.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page - 1) * size,
        take: size,
        include: { partner: { select: { name_en: true } }, regions: { select: { name_ru: true, name_en: true } } },
      }),
    ]);
    return {
      data: rows.map((t) => ({
        id: t.id,
        name_ru: t.name_ru,
        name_en: t.name_en,
        sku_id: t.sku_id,
        status: t.status,
        provider: t.partner?.name_en ?? null,
        data_gb: t.quantity_internet,
        validity_days: t.validity_period,
        is_4g: t.is_4g,
        is_5g: t.is_5g,
        regions: t.regions.map((r) => r.name_ru),
        retail_price_rub: t.price_sell,
        cost_price_rub: t.price_arrival,
      })),
      meta: { page, size, total },
    };
  }

  private presentResellerTariff(r: any, currency: string) {
    return {
      tariff_id: r.tariff_id,
      name_ru: r.tariff.name_ru,
      name_en: r.tariff.name_en,
      data_gb: r.tariff.quantity_internet,
      validity_days: r.tariff.validity_period,
      price_kopecks: toNumber(r.price_kopecks),
      currency,
      price_version: r.price_version,
      active: r.active,
      central_status: r.tariff.status,
      cost_kopecks: r.tariff.price_arrival == null ? null : r.tariff.price_arrival * 100,
      cost_currency: r.tariff.price_arrival == null ? null : 'RUB',
      updated_at: r.updated_at ?? r.created_at,
    };
  }

  async listResellerTariffs(resellerId: number) {
    const reseller = await this.requireReseller(resellerId);
    const rows = await this.prisma.resellerTariff.findMany({
      where: { reseller_id: resellerId },
      orderBy: { tariff_id: 'asc' },
      include: { tariff: true },
    });
    return rows.map((r) => this.presentResellerTariff(r, reseller.currency));
  }

  /**
   * Тарифы компании с фильтрами, сортировкой и постраничной выдачей (всё на уровне базы).
   * facets — какие значения трафика и срока вообще есть у компании: для списков выбора в интерфейсе.
   */
  async searchResellerTariffs(resellerId: number, q: ResellerTariffsQueryDto) {
    const reseller = await this.requireReseller(resellerId);
    const page = q.page ?? 1;
    const size = q.size ?? 20;
    const term = q.search?.trim();
    const tariffWhere: Prisma.TariffWhereInput = {
      ...(q.data_gb !== undefined ? { quantity_internet: q.data_gb } : {}),
      ...(q.validity_days !== undefined ? { validity_period: q.validity_days } : {}),
      ...(term
        ? {
            OR: [
              { name_ru: { contains: term, mode: 'insensitive' } },
              { name_en: { contains: term, mode: 'insensitive' } },
              ...(/^\d{1,9}$/.test(term) ? [{ id: Number(term) }] : []),
            ],
          }
        : {}),
    };
    const where: Prisma.ResellerTariffWhereInput = {
      reseller_id: resellerId,
      ...(Object.keys(tariffWhere).length ? { tariff: tariffWhere } : {}),
      ...(q.active ? { active: q.active === 'true' } : {}),
      ...(q.min_price_kopecks !== undefined || q.max_price_kopecks !== undefined
        ? {
            price_kopecks: {
              ...(q.min_price_kopecks !== undefined ? { gte: BigInt(q.min_price_kopecks) } : {}),
              ...(q.max_price_kopecks !== undefined ? { lte: BigInt(q.max_price_kopecks) } : {}),
            },
          }
        : {}),
    };
    const dir = q.order ?? 'asc';
    const orderBy: Prisma.ResellerTariffOrderByWithRelationInput[] = [
      q.sort === 'name'
        ? { tariff: { name_ru: dir } }
        : q.sort === 'data_gb'
          ? { tariff: { quantity_internet: dir } }
          : q.sort === 'validity_days'
            ? { tariff: { validity_period: dir } }
            : q.sort === 'price'
              ? { price_kopecks: dir }
              : { tariff_id: dir },
      { tariff_id: 'asc' },
    ];
    const mine = { reseller_tariffs: { some: { reseller_id: resellerId } } };
    const [total, rows, gb, days] = await Promise.all([
      this.prisma.resellerTariff.count({ where }),
      this.prisma.resellerTariff.findMany({ where, orderBy, skip: (page - 1) * size, take: size, include: { tariff: true } }),
      this.prisma.tariff.findMany({ where: mine, distinct: ['quantity_internet'], select: { quantity_internet: true } }),
      this.prisma.tariff.findMany({ where: mine, distinct: ['validity_period'], select: { validity_period: true } }),
    ]);
    const nums = (list: (number | null)[]) => [...new Set(list.filter((v): v is number => v != null))].sort((a, b) => a - b);
    return {
      data: rows.map((r) => this.presentResellerTariff(r, reseller.currency)),
      meta: { page, size, total, pages: Math.max(1, Math.ceil(total / size)) },
      facets: { data_gb: nums(gb.map((t) => t.quantity_internet)), validity_days: nums(days.map((t) => t.validity_period)) },
    };
  }

  /** Назначает тариф компании или меняет цену/доступность. Версия цены растёт при каждой смене суммы. */
  async upsertResellerTariff(resellerId: number, tariffId: number, dto: UpsertResellerTariffDto) {
    const reseller = await this.requireReseller(resellerId);
    const tariff = await this.prisma.tariff.findFirst({ where: { id: tariffId, deleted_at: null } });
    if (!tariff) throw new NotFoundException('Тариф не найден');
    const price = parseKopecks(dto.price_kopecks);

    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.resellerTariff.findUnique({
        where: { reseller_id_tariff_id: { reseller_id: resellerId, tariff_id: tariffId } },
      });
      if (!current) {
        return tx.resellerTariff.create({
          data: { reseller_id: resellerId, tariff_id: tariffId, price_kopecks: price, active: dto.active ?? true },
        });
      }
      const priceChanged = current.price_kopecks !== price;
      return tx.resellerTariff.update({
        where: { id: current.id },
        data: {
          price_kopecks: price,
          ...(priceChanged ? { price_version: { increment: 1 } } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    });

    return {
      tariff_id: row.tariff_id,
      price_kopecks: toNumber(row.price_kopecks),
      currency: reseller.currency,
      price_version: row.price_version,
      active: row.active,
    };
  }

  /**
   * Массовая загрузка тарифов компании из Excel. Новые тарифы создаются скрытыми на розничном сайте (hide_site) и сразу
   * привязываются к компании с её ценой; уже существующий тариф (тот же SKU и поставщик) не меняется, а только привязывается.
   * dry_run — только проверка. Запись — всё или ничего: при любой ошибке в строках ничего не сохраняется.
   */
  async importTariffs(resellerId: number, dto: ImportTariffsDto) {
    const reseller = await this.requireReseller(resellerId);
    const rows = dto.items as unknown as ImportRow[];
    const skus = [...new Set(rows.map((r) => String(r.sku_id ?? '').trim()).filter(Boolean))];
    const [partners, groups, existing] = await Promise.all([
      this.prisma.partner.findMany({ select: { id: true, name_ru: true, name_en: true, identified_number: true } }),
      this.prisma.regionGroup.findMany({ select: { id: true, name_ru: true, name_en: true, _count: { select: { regions: true } } } }),
      this.prisma.tariff.findMany({ where: { deleted_at: null, sku_id: { in: skus } }, select: { id: true, sku_id: true, partner_id: true } }),
    ]);
    const attached = new Set(
      (
        await this.prisma.resellerTariff.findMany({
          where: { reseller_id: resellerId, tariff_id: { in: existing.map((t) => t.id) } },
          select: { tariff_id: true },
        })
      ).map((r) => r.tariff_id),
    );
    const plan = planImport(rows, {
      currency: reseller.currency,
      partners,
      groups: groups.map((g) => ({ id: g.id, name_ru: g.name_ru, name_en: g.name_en, regions: g._count.regions })),
      existing,
      attached,
    });
    const summary = summarize(plan);
    const report = (applied: boolean, list: PlannedRow[]) => ({
      dry_run: dto.dry_run,
      applied,
      currency: reseller.currency,
      summary,
      rows: list.map(({ create: _c, ...p }) => p),
    });
    if (dto.dry_run || summary.error > 0) return report(false, plan);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const done = plan.map((p) => ({ ...p }));
        for (const [i, p] of plan.entries()) {
          if (p.verdict === 'SKIP') continue;
          const src = rows[i];
          let tariffId = p.tariff_id;
          if (p.verdict === 'CREATE') {
            const c = p.create!;
            const group = await tx.regionGroup.findUniqueOrThrow({ where: { id: c.region_group_id }, select: { regions: { select: { id: true } } } });
            const t = await tx.tariff.create({
              data: {
                name_ru: src.name_ru.trim(),
                name_en: src.name_en.trim(),
                title_ru: src.name_ru.trim(),
                title_en: src.name_en.trim(),
                status: 'ACTIVE',
                hide_site: true,
                partner_id: c.partner_id,
                sku_id: p.sku_id,
                is_4g: !!src.is_4g,
                is_5g: !!src.is_5g,
                quantity_internet: src.data_gb,
                quantity_sms: src.sms ?? 0,
                quantity_minute: src.minutes ?? 0,
                validity_period: src.validity_days,
                price_arrival: c.price_arrival,
                cashback_percent: 0,
                is_local: c.kind === 'local',
                is_regional: c.kind === 'regional',
                is_global: c.kind === 'global',
                region_group_id: c.region_group_id,
                regions: { connect: group.regions.map((r) => ({ id: r.id })) },
              },
              select: { id: true },
            });
            tariffId = t.id;
            done[i].tariff_id = t.id;
          }
          await tx.resellerTariff.create({
            data: { reseller_id: resellerId, tariff_id: tariffId!, price_kopecks: BigInt(p.price_kopecks!), active: true },
          });
        }
        return done;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return report(true, created);
  }

  // ----------------------------------------------------------------- деньги

  async balance(resellerId: number) {
    const reseller = await this.requireReseller(resellerId);
    return presentBalance(await this.ledger.getBalance(resellerId), reseller.currency);
  }

  async topUp(resellerId: number, dto: MoneyOperationDto, actor: string | null) {
    const reseller = await this.requireReseller(resellerId);
    const res = await this.ledger.topUp({
      resellerId,
      amount: parseKopecks(dto.amount_kopecks),
      comment: dto.comment,
      actor: actor ?? undefined,
      idempotencyKey: dto.idempotency_key ?? `topup:${randomUUID()}`,
    });
    return { applied: res.applied, entry: presentLedgerEntry(res.entry), balance: presentBalance(await this.ledger.getBalance(resellerId), reseller.currency) };
  }

  async adjust(resellerId: number, dto: MoneyOperationDto, actor: string | null) {
    const reseller = await this.requireReseller(resellerId);
    const res = await this.ledger.adjust({
      resellerId,
      amount: parseKopecks(dto.amount_kopecks),
      comment: dto.comment,
      actor: actor ?? undefined,
      idempotencyKey: dto.idempotency_key ?? `adjust:${randomUUID()}`,
    });
    return { applied: res.applied, entry: presentLedgerEntry(res.entry), balance: presentBalance(await this.ledger.getBalance(resellerId), reseller.currency) };
  }

  async listLedger(resellerId: number, q: PageQueryDto) {
    await this.requireReseller(resellerId);
    const rows = await this.prisma.resellerLedger.findMany({
      where: { reseller_id: resellerId, ...(q.before_id ? { id: { lt: q.before_id } } : {}) },
      orderBy: { id: 'desc' },
      take: Math.min(q.size ?? 50, 200),
      include: { order: { select: { client_order_id: true } } },
    });
    return rows.map(presentLedgerEntry);
  }

  private async requireReseller(id: number) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id } });
    if (!reseller) throw new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: 'Компания не найдена' });
    return reseller;
  }
}

