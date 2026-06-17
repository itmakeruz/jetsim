import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentBalanceLedgerStatus,
  AgentBalanceLedgerType,
  Prisma,
  PromoCodeCreationMode,
  PromoUsageStatus,
  Status,
  UserRoles,
} from '@prisma/client';
import { PrismaService } from '@prisma';
import {
  AgentPromoReportQueryDto,
  AdminPromoReportQueryDto,
  CreatePromoCodeDto,
  FindPromoCodeDto,
  PromoCodeRequestCreationMode,
  PromoLimitType,
  UpdatePromoCodeDto,
  UpdatePromoSettingsDto,
  ValidatePromoCodeDto,
  CreateAgentPromoCodeDto,
} from './dto';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';

type EffectivePromoSettings = {
  client_discount_amount: number;
  agent_credit_amount: number;
  is_creation_enabled: boolean;
  creation_mode: PromoCodeCreationMode;
  allow_limit_once: boolean;
  allow_limit_unlimited: boolean;
  allow_limit_custom: boolean;
  allow_no_expiry: boolean;
  allow_expires_at: boolean;
};

type ValidatedPromoForPayment = {
  id: number;
  code: string;
  agent_id: number | null;
  discount_amount: number;
  agent_credit_amount: number;
};

type AgentReportUsage = Prisma.PromoUsageGetPayload<{
  include: ReturnType<PromoCodeService['agentReportUsageInclude']>;
}>;

type AdminReportUsage = Prisma.PromoUsageGetPayload<{
  include: ReturnType<PromoCodeService['adminReportUsageInclude']>;
}>;

type PromoReportUsage = AgentReportUsage | AdminReportUsage;

type PromoReportTotals = {
  grossAmount: number;
  paidAmount: number;
  discountAmount: number;
  agentCreditAmount: number;
};

type AdminAggregateRow = PromoReportTotals & {
  key: string;
  id?: number;
  name?: string;
  login?: string;
  code?: string;
  status?: Status | PromoUsageStatus | string;
  creation_mode?: PromoCodeCreationMode | string;
  usagesCount: number;
  uniqueClientIds: Set<number>;
};

const DEFAULT_PROMO_SETTINGS: EffectivePromoSettings = {
  client_discount_amount: 50000,
  agent_credit_amount: 70000,
  is_creation_enabled: true,
  creation_mode: PromoCodeCreationMode.BOTH,
  allow_limit_once: true,
  allow_limit_unlimited: true,
  allow_limit_custom: true,
  allow_no_expiry: true,
  allow_expires_at: true,
};

@Injectable()
export class PromoCodeService {
  private readonly cacheTtlMs = 60_000;
  private settingsCache?: { expiresAt: number; value: EffectivePromoSettings };

  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.getOrCreateSettings();
    return {
      success: true,
      data: this.formatSettings(settings),
    };
  }

  async updateSettings(data: UpdatePromoSettingsDto) {
    const settings = await this.getOrCreateSettings();
    const updated = await this.prisma.promoSettings.update({
      where: { id: settings.id },
      data: {
        ...(this.hasOwn(data, 'default_client_discount_amount') && {
          default_client_discount_amount:
            data.default_client_discount_amount == null ? null : this.toMinor(data.default_client_discount_amount),
        }),
        ...(this.hasOwn(data, 'default_agent_credit_amount') && {
          default_agent_credit_amount:
            data.default_agent_credit_amount == null ? null : this.toMinor(data.default_agent_credit_amount),
        }),
        ...(this.hasOwn(data, 'is_agent_creation_enabled') && {
          is_agent_creation_enabled: data.is_agent_creation_enabled,
        }),
        ...(this.hasOwn(data, 'agent_creation_mode') && { agent_creation_mode: data.agent_creation_mode }),
        ...(this.hasOwn(data, 'allow_limit_once') && { allow_limit_once: data.allow_limit_once }),
        ...(this.hasOwn(data, 'allow_limit_unlimited') && { allow_limit_unlimited: data.allow_limit_unlimited }),
        ...(this.hasOwn(data, 'allow_limit_custom') && { allow_limit_custom: data.allow_limit_custom }),
        ...(this.hasOwn(data, 'allow_no_expiry') && { allow_no_expiry: data.allow_no_expiry }),
        ...(this.hasOwn(data, 'allow_expires_at') && { allow_expires_at: data.allow_expires_at }),
      },
    });

    this.clearCache();

    return {
      success: true,
      message: 'Настройки промокодов обновлены!',
      data: this.formatSettings(updated),
    };
  }

  async findAllAdmin(query: FindPromoCodeDto) {
    const page = Number(query.page ?? 1);
    const size = Number(query.size ?? 20);
    const where: Prisma.PromoCodeWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.agent_id && { agent_id: query.agent_id }),
      ...(query.search && {
        OR: [
          { code: { contains: this.normalizeSearch(query.search), mode: 'insensitive' } },
          { agent: { name: { contains: query.search, mode: 'insensitive' } } },
          { agent: { login: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.promoCode.count({ where }),
      this.prisma.promoCode.findMany({
        where,
        include: this.promoCodeInclude(),
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    return {
      success: true,
      data: data.map((promo) => this.formatPromoCode(promo)),
      meta: this.getMeta(totalItems, page, size),
    };
  }

  async findMy(agentId: number, query: FindPromoCodeDto) {
    const page = Number(query.page ?? 1);
    const size = Number(query.size ?? 20);
    const where: Prisma.PromoCodeWhereInput = {
      agent_id: agentId,
      ...(query.status && { status: query.status }),
      ...(query.search && { code: { contains: this.normalizeSearch(query.search), mode: 'insensitive' } }),
    };

    const [totalItems, data, balance] = await this.prisma.$transaction([
      this.prisma.promoCode.count({ where }),
      this.prisma.promoCode.findMany({
        where,
        include: this.promoCodeInclude(),
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.agentBalanceLedger.aggregate({
        where: {
          agent_id: agentId,
          status: AgentBalanceLedgerStatus.CONFIRMED,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        balance: this.toMajor(balance._sum.amount ?? 0),
        items: data.map((promo) => this.formatPromoCode(promo)),
      },
      meta: this.getMeta(totalItems, page, size),
    };
  }

  async createAdmin(staffId: number, data: CreatePromoCodeDto) {
    const settings = await this.getCachedSettings();
    const agent = data.agent_id ? await this.ensureAgent(data.agent_id) : null;
    const code = data.code ? this.normalizeCode(data.code) : await this.generateUniqueCode();
    const creationMode = data.code ? PromoCodeCreationMode.MANUAL : PromoCodeCreationMode.AUTO;
    const limitType = data.limit_type ?? PromoLimitType.UNLIMITED;
    const usageLimit = this.resolveUsageLimit(limitType, data.usage_limit);

    await this.ensureCodeIsAvailable(code);

    const promo = await this.prisma.promoCode.create({
      data: {
        code,
        status: data.status ?? Status.ACTIVE,
        creation_mode: creationMode,
        usage_limit: usageLimit,
        expires_at: data.expires_at ? new Date(data.expires_at) : null,
        client_discount_amount: settings.client_discount_amount,
        agent_credit_amount: agent ? settings.agent_credit_amount : 0,
        agent_id: agent?.id,
        created_by_staff_id: staffId,
      },
      include: this.promoCodeInclude(),
    });

    return {
      success: true,
      message: 'Промокод создан!',
      data: this.formatPromoCode(promo),
    };
  }

  async createForAgent(agentId: number, data: CreateAgentPromoCodeDto) {
    await this.ensureAgent(agentId);
    const settings = await this.getCachedSettings();
    const actualCreationMode = this.resolveAgentCreationMode(data);
    const code =
      actualCreationMode === PromoCodeCreationMode.MANUAL
        ? this.normalizeCode(data.code!)
        : await this.generateUniqueCode();
    const limitType = data.limit_type ?? PromoLimitType.UNLIMITED;
    const usageLimit = this.resolveUsageLimit(limitType, data.usage_limit);

    this.assertAgentCanCreate(settings, actualCreationMode, limitType, data.expires_at);
    await this.ensureCodeIsAvailable(code);

    const promo = await this.prisma.promoCode.create({
      data: {
        code,
        status: Status.ACTIVE,
        creation_mode: actualCreationMode,
        usage_limit: usageLimit,
        expires_at: data.expires_at ? new Date(data.expires_at) : null,
        client_discount_amount: settings.client_discount_amount,
        agent_credit_amount: settings.agent_credit_amount,
        agent_id: agentId,
        created_by_staff_id: agentId,
      },
      include: this.promoCodeInclude(),
    });

    return {
      success: true,
      message: 'Промокод создан!',
      data: this.formatPromoCode(promo),
    };
  }

  async updateAdmin(id: number, data: UpdatePromoCodeDto) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Промокод не найден!');
    }

    const code = data.code ? this.normalizeCode(data.code) : undefined;
    if (code && code !== promo.code) {
      await this.ensureCodeIsAvailable(code);
    }

    const agent = data.agent_id ? await this.ensureAgent(data.agent_id) : undefined;

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(data.status && { status: data.status }),
        ...(data.limit_type && { usage_limit: this.resolveUsageLimit(data.limit_type, data.usage_limit) }),
        ...(data.expires_at !== undefined && { expires_at: data.expires_at ? new Date(data.expires_at) : null }),
        ...(agent !== undefined && { agent_id: agent.id }),
      },
      include: this.promoCodeInclude(),
    });

    return {
      success: true,
      message: 'Промокод обновлен!',
      data: this.formatPromoCode(updated),
    };
  }

  async changeStatus(id: number, status: Status) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Промокод не найден!');
    }

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: { status },
      include: this.promoCodeInclude(),
    });

    return {
      success: true,
      message: 'Статус промокода обновлен!',
      data: this.formatPromoCode(updated),
    };
  }

  async getAgentSettings() {
    const settings = await this.getCachedSettings();
    return {
      success: true,
      data: this.formatEffectiveSettings(settings),
    };
  }

  async getAgentStatistics(agentId: number, query: AgentPromoReportQueryDto) {
    const agent = await this.ensureAgent(agentId);
    const [promoCount, activePromoCount, inactivePromoCount, usages, balance] = await Promise.all([
      this.prisma.promoCode.count({ where: { agent_id: agentId } }),
      this.prisma.promoCode.count({ where: { agent_id: agentId, status: Status.ACTIVE } }),
      this.prisma.promoCode.count({ where: { agent_id: agentId, status: Status.INACTIVE } }),
      this.getAgentReportUsages(agentId, query),
      this.prisma.agentBalanceLedger.aggregate({
        where: {
          agent_id: agentId,
          status: AgentBalanceLedgerStatus.CONFIRMED,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);
    const totals = this.calculateAgentReportTotals(usages);

    return {
      success: true,
      data: {
        agent,
        filters: this.formatAgentReportFilters(query),
        balance: this.toMajor(balance._sum.amount ?? 0),
        promocodes: {
          total: promoCount,
          active: activePromoCount,
          inactive: inactivePromoCount,
        },
        report: {
          usages_count: usages.length,
          unique_clients_count: new Set(usages.map((usage) => usage.user_id)).size,
          gross_sales_amount: this.toMajor(totals.grossAmount),
          paid_amount: this.toMajor(totals.paidAmount),
          client_discount_amount: this.toMajor(totals.discountAmount),
          agent_credit_amount: this.toMajor(totals.agentCreditAmount),
          average_paid_amount: this.toMajor(usages.length ? Math.round(totals.paidAmount / usages.length) : 0),
        },
      },
    };
  }

  async getAgentReportExcel(agentId: number, query: AgentPromoReportQueryDto) {
    const agent = await this.ensureAgent(agentId);
    const usages = await this.getAgentReportUsages(agentId, query);
    const totals = this.calculateAgentReportTotals(usages);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jetsim API';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Отчет', {
      views: [{ state: 'frozen', ySplit: 11 }],
    });

    sheet.mergeCells('A1:N1');
    sheet.getCell('A1').value = 'Отчет по промокодам агента';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    sheet.getRow(1).height = 28;

    const filters = this.formatAgentReportFilters(query);
    const infoRows = [
      ['Агент', agent.name],
      ['Логин', agent.login],
      ['Период', `${filters.date_from ?? 'Без ограничения'} - ${filters.date_to ?? 'Без ограничения'}`],
      ['Статус', filters.status],
      ['Промокод', filters.promo_code ?? 'Все'],
      ['Сформировано', new Date()],
    ];

    infoRows.forEach((row, index) => {
      const rowNumber = index + 3;
      sheet.getCell(`A${rowNumber}`).value = row[0];
      sheet.getCell(`B${rowNumber}`).value = row[1];
      sheet.getCell(`A${rowNumber}`).font = { bold: true };
      sheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'left' };
    });
    sheet.getCell('B8').numFmt = 'dd.mm.yyyy hh:mm';

    const summaryRows = [
      ['Количество продаж', usages.length],
      ['Уникальные клиенты', new Set(usages.map((usage) => usage.user_id)).size],
      ['Сумма до скидки', this.toMajor(totals.grossAmount)],
      ['Оплачено клиентами', this.toMajor(totals.paidAmount)],
      ['Скидка клиентам', this.toMajor(totals.discountAmount)],
      ['Начислено агенту', this.toMajor(totals.agentCreditAmount)],
    ];

    summaryRows.forEach((row, index) => {
      const rowNumber = index + 3;
      sheet.getCell(`D${rowNumber}`).value = row[0];
      sheet.getCell(`E${rowNumber}`).value = row[1];
      sheet.getCell(`D${rowNumber}`).font = { bold: true };
      sheet.getCell(`E${rowNumber}`).font = { bold: index === summaryRows.length - 1 };
      if (index >= 2) sheet.getCell(`E${rowNumber}`).numFmt = '#,##0.00';
    });

    const headerRowNumber = 11;
    const headers = [
      '№',
      'Дата оплаты',
      'Промокод',
      'Тип создания',
      'Клиент',
      'Email',
      'Телефон',
      'Transaction ID',
      'Order ID',
      'Сумма до скидки',
      'Оплачено клиентом',
      'Скидка клиенту',
      'Начислено агенту',
      'Статус',
    ];

    sheet.getRow(headerRowNumber).values = headers;
    sheet.getRow(headerRowNumber).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(headerRowNumber).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(headerRowNumber).height = 32;
    sheet.getRow(headerRowNumber).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } };
      cell.border = this.excelBorder();
    });

    usages.forEach((usage, index) => {
      const paidAmount = Number(usage.transaction?.amount ?? 0);
      const discountAmount = usage.discount_amount ?? 0;
      const row = sheet.addRow([
        index + 1,
        usage.confirmed_at ?? usage.created_at,
        usage.promo_code.code,
        usage.promo_code.creation_mode,
        usage.user?.name ?? '',
        usage.user?.email ?? '',
        usage.user?.phone_number ?? '',
        usage.transaction_id ?? '',
        usage.order_id ?? '',
        this.toMajor(paidAmount + discountAmount),
        this.toMajor(paidAmount),
        this.toMajor(discountAmount),
        this.toMajor(usage.agent_credit_amount),
        usage.status,
      ]);

      row.eachCell((cell, columnNumber) => {
        cell.border = this.excelBorder();
        cell.alignment = { vertical: 'middle', wrapText: columnNumber >= 5 && columnNumber <= 7 };
      });

      [10, 11, 12, 13].forEach((columnNumber) => {
        row.getCell(columnNumber).numFmt = '#,##0.00';
      });
      row.getCell(2).numFmt = 'dd.mm.yyyy hh:mm';
    });

    const totalRow = sheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Итого:',
      this.toMajor(totals.grossAmount),
      this.toMajor(totals.paidAmount),
      this.toMajor(totals.discountAmount),
      this.toMajor(totals.agentCreditAmount),
      '',
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.border = this.excelBorder();
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    });
    [10, 11, 12, 13].forEach((columnNumber) => {
      totalRow.getCell(columnNumber).numFmt = '#,##0.00';
    });

    sheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 16 },
      { width: 16 },
      { width: 24 },
      { width: 30 },
      { width: 18 },
      { width: 16 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
    ];
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: headers.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ExcelJS.Buffer;
  }

  async getAdminStatistics(query: AdminPromoReportQueryDto) {
    const usages = await this.getAdminReportUsages(query);
    const totals = this.calculateAgentReportTotals(usages);
    const promoWhere = this.buildAdminPromoWhere(query, true);
    const promoWhereWithoutStatus = this.buildAdminPromoWhere(query, false);

    const [agentCount, activeAgentCount, promoCount, activePromoCount, inactivePromoCount] = await Promise.all([
      this.prisma.staff.count({ where: { role: UserRoles.AGENT } }),
      this.prisma.staff.count({ where: { role: UserRoles.AGENT, status: Status.ACTIVE } }),
      this.prisma.promoCode.count({ where: promoWhere }),
      this.prisma.promoCode.count({ where: { ...promoWhereWithoutStatus, status: Status.ACTIVE } }),
      this.prisma.promoCode.count({ where: { ...promoWhereWithoutStatus, status: Status.INACTIVE } }),
    ]);
    const byAgent = this.aggregateAdminAgentRows(usages);
    const byPromoCode = this.aggregateAdminPromoRows(usages);

    return {
      success: true,
      data: {
        filters: this.formatAdminReportFilters(query),
        agents: {
          total: agentCount,
          active: activeAgentCount,
          with_sales: byAgent.length,
        },
        promocodes: {
          total: promoCount,
          active: activePromoCount,
          inactive: inactivePromoCount,
          with_sales: byPromoCode.length,
        },
        report: {
          usages_count: usages.length,
          unique_clients_count: new Set(usages.map((usage) => usage.user_id)).size,
          gross_sales_amount: this.toMajor(totals.grossAmount),
          paid_amount: this.toMajor(totals.paidAmount),
          client_discount_amount: this.toMajor(totals.discountAmount),
          agent_credit_amount: this.toMajor(totals.agentCreditAmount),
          average_paid_amount: this.toMajor(usages.length ? Math.round(totals.paidAmount / usages.length) : 0),
        },
        top_agents: byAgent.slice(0, 10).map((row) => this.formatAdminAggregateRow(row)),
        top_promocodes: byPromoCode.slice(0, 10).map((row) => this.formatAdminAggregateRow(row)),
      },
    };
  }

  async getAdminReportExcel(query: AdminPromoReportQueryDto) {
    const usages = await this.getAdminReportUsages(query);
    const totals = this.calculateAgentReportTotals(usages);
    const byAgent = this.aggregateAdminAgentRows(usages);
    const byPromoCode = this.aggregateAdminPromoRows(usages);
    const filters = this.formatAdminReportFilters(query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jetsim API';
    workbook.created = new Date();

    this.buildAdminSummarySheet(workbook, filters, usages, totals, byAgent, byPromoCode);
    this.buildAdminSalesSheet(workbook, usages, totals);
    this.buildAdminAgentsSheet(workbook, byAgent);
    this.buildAdminPromoCodesSheet(workbook, byPromoCode);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ExcelJS.Buffer;
  }

  async validatePublic(userId: number, data: ValidatePromoCodeDto) {
    const basketTotal = await this.getUserBasketTotal(userId);
    const promo = await this.validateCodeForPayment(userId, data.code, basketTotal);

    return {
      success: true,
      message: 'Промокод применим!',
      data: {
        code: promo.code,
        discount_amount: this.toMajor(promo.discount_amount),
        agent_credit_amount: this.toMajor(promo.agent_credit_amount),
        total_amount: this.toMajor(basketTotal),
        final_amount: this.toMajor(basketTotal - promo.discount_amount),
      },
    };
  }

  async validateCodeForPayment(
    userId: number,
    code: string | undefined,
    totalAmount: number,
  ): Promise<ValidatedPromoForPayment | null> {
    if (!code) return null;
    if (totalAmount <= 0) {
      throw new BadRequestException('Корзина пуста!');
    }

    const normalizedCode = this.normalizeCode(code);
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: normalizedCode },
      include: {
        usages: {
          where: {
            user_id: userId,
            status: PromoUsageStatus.CONFIRMED,
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!promo || promo.status !== Status.ACTIVE) {
      throw new NotFoundException('Промокод не найден или неактивен!');
    }

    if (promo.expires_at && promo.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия промокода истек!');
    }

    if (promo.usage_limit != null && promo.used_count >= promo.usage_limit) {
      throw new BadRequestException('Лимит использования промокода исчерпан!');
    }

    if (promo.usage_limit === 1 && promo.usages.length > 0) {
      throw new BadRequestException('Вы уже использовали этот промокод!');
    }

    const discountAmount = Math.min(promo.client_discount_amount, totalAmount);
    if (totalAmount - discountAmount <= 0) {
      throw new BadRequestException('Сумма оплаты после промокода должна быть больше 0!');
    }

    return {
      id: promo.id,
      code: promo.code,
      agent_id: promo.agent_id,
      discount_amount: discountAmount,
      agent_credit_amount: promo.agent_id ? promo.agent_credit_amount : 0,
    };
  }

  async createPendingUsage(params: {
    promo: ValidatedPromoForPayment | null;
    userId: number;
    transactionId: number;
    orderId: number;
  }) {
    if (!params.promo) return null;

    return this.prisma.promoUsage.create({
      data: {
        promo_code_id: params.promo.id,
        user_id: params.userId,
        transaction_id: params.transactionId,
        order_id: params.orderId,
        status: PromoUsageStatus.PENDING,
        discount_amount: params.promo.discount_amount,
        agent_credit_amount: params.promo.agent_credit_amount,
      },
    });
  }

  async confirmUsageByTransaction(transactionId: number) {
    const usage = await this.prisma.promoUsage.findUnique({
      where: { transaction_id: transactionId },
      include: {
        promo_code: true,
      },
    });

    if (!usage || usage.status !== PromoUsageStatus.PENDING) return;

    await this.prisma.$transaction(async (tx) => {
      const promoWhere: Prisma.PromoCodeWhereInput = {
        id: usage.promo_code_id,
        status: Status.ACTIVE,
      };

      if (usage.promo_code.usage_limit != null) {
        promoWhere.used_count = { lt: usage.promo_code.usage_limit };
      }

      const updatedPromo = await tx.promoCode.updateMany({
        where: promoWhere,
        data: {
          used_count: { increment: 1 },
        },
      });

      if (updatedPromo.count === 0) {
        await tx.promoUsage.update({
          where: { id: usage.id },
          data: {
            status: PromoUsageStatus.CANCELED,
            canceled_at: new Date(),
          },
        });
        return;
      }

      await tx.promoUsage.update({
        where: { id: usage.id },
        data: {
          status: PromoUsageStatus.CONFIRMED,
          confirmed_at: new Date(),
        },
      });

      if (usage.promo_code.agent_id && usage.agent_credit_amount > 0) {
        await tx.agentBalanceLedger.create({
          data: {
            agent_id: usage.promo_code.agent_id,
            promo_usage_id: usage.id,
            amount: usage.agent_credit_amount,
            type: AgentBalanceLedgerType.CREDIT,
            status: AgentBalanceLedgerStatus.CONFIRMED,
          },
        });
      }
    });
  }

  async cancelUsageByTransaction(transactionId: number) {
    await this.prisma.promoUsage.updateMany({
      where: {
        transaction_id: transactionId,
        status: PromoUsageStatus.PENDING,
      },
      data: {
        status: PromoUsageStatus.CANCELED,
        canceled_at: new Date(),
      },
    });
  }

  private async getAgentReportUsages(agentId: number, query: AgentPromoReportQueryDto) {
    return this.prisma.promoUsage.findMany({
      where: this.buildAgentReportWhere(agentId, query),
      include: this.agentReportUsageInclude(),
      orderBy: [{ confirmed_at: 'desc' }, { created_at: 'desc' }],
    });
  }

  private buildAgentReportWhere(agentId: number, query: AgentPromoReportQueryDto): Prisma.PromoUsageWhereInput {
    const status = query.status ?? PromoUsageStatus.CONFIRMED;
    const where: Prisma.PromoUsageWhereInput = {
      status,
      promo_code: {
        agent_id: agentId,
        ...(query.promo_code?.trim() && {
          code: { contains: this.normalizeSearch(query.promo_code), mode: 'insensitive' },
        }),
      },
    };
    const dateFilter = this.buildDateFilter(query.date_from, query.date_to);

    if (dateFilter) {
      if (status === PromoUsageStatus.CONFIRMED) {
        where.confirmed_at = dateFilter;
      } else if (status === PromoUsageStatus.CANCELED) {
        where.canceled_at = dateFilter;
      } else {
        where.created_at = dateFilter;
      }
    }

    return where;
  }

  private buildDateFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;

    const filter: Prisma.DateTimeFilter = {};
    if (dateFrom) filter.gte = this.parseReportDate(dateFrom, false);
    if (dateTo) filter.lte = this.parseReportDate(dateTo, true);

    if (filter.gte && filter.lte && filter.gte > filter.lte) {
      throw new BadRequestException('Дата начала не может быть позже даты окончания!');
    }

    return filter;
  }

  private parseReportDate(value: string, isEndOfDay: boolean) {
    let date: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      date = new Date(
        year,
        month - 1,
        day,
        isEndOfDay ? 23 : 0,
        isEndOfDay ? 59 : 0,
        isEndOfDay ? 59 : 0,
        isEndOfDay ? 999 : 0,
      );
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Некорректная дата для отчета!');
    }

    return date;
  }

  private async getAdminReportUsages(query: AdminPromoReportQueryDto) {
    return this.prisma.promoUsage.findMany({
      where: this.buildAdminReportWhere(query),
      include: this.adminReportUsageInclude(),
      orderBy: [{ confirmed_at: 'desc' }, { created_at: 'desc' }],
    });
  }

  private buildAdminReportWhere(query: AdminPromoReportQueryDto): Prisma.PromoUsageWhereInput {
    const status = query.status ?? PromoUsageStatus.CONFIRMED;
    const where: Prisma.PromoUsageWhereInput = {
      status,
      ...(query.transaction_id && { transaction_id: query.transaction_id }),
      ...(query.order_id && { order_id: query.order_id }),
      ...(query.client_email?.trim() && {
        user: { email: { contains: query.client_email.trim(), mode: 'insensitive' } },
      }),
      ...(query.client_phone?.trim() && {
        user: { phone_number: { contains: query.client_phone.trim(), mode: 'insensitive' } },
      }),
      ...(query.transaction_status && {
        transaction: { status: query.transaction_status },
      }),
      promo_code: this.buildAdminPromoWhere(query, true),
    };
    const dateFilter = this.buildDateFilter(query.date_from, query.date_to);

    if (dateFilter) {
      if (status === PromoUsageStatus.CONFIRMED) {
        where.confirmed_at = dateFilter;
      } else if (status === PromoUsageStatus.CANCELED) {
        where.canceled_at = dateFilter;
      } else {
        where.created_at = dateFilter;
      }
    }

    return where;
  }

  private buildAdminPromoWhere(query: AdminPromoReportQueryDto, includeStatus: boolean): Prisma.PromoCodeWhereInput {
    return {
      ...(query.agent_id && { agent_id: query.agent_id }),
      ...(query.promo_code?.trim() && {
        code: { contains: this.normalizeSearch(query.promo_code), mode: 'insensitive' },
      }),
      ...(query.creation_mode && { creation_mode: query.creation_mode }),
      ...(includeStatus && query.promocode_status && { status: query.promocode_status }),
      ...((query.agent_login?.trim() || query.agent_name?.trim()) && {
        agent: {
          ...(query.agent_login?.trim() && {
            login: { contains: query.agent_login.trim(), mode: 'insensitive' },
          }),
          ...(query.agent_name?.trim() && {
            name: { contains: query.agent_name.trim(), mode: 'insensitive' },
          }),
        },
      }),
    };
  }

  private aggregateAdminAgentRows(usages: AdminReportUsage[]): AdminAggregateRow[] {
    const rows = new Map<string, AdminAggregateRow>();

    for (const usage of usages) {
      const agent = usage.promo_code.agent;
      const key = String(agent?.id ?? 'no-agent');
      const row =
        rows.get(key) ??
        this.createAdminAggregateRow({
          key,
          id: agent?.id,
          name: agent?.name ?? 'Без агента',
          login: agent?.login ?? '',
          status: agent?.status ?? '',
        });

      this.addUsageToAggregateRow(row, usage);
      rows.set(key, row);
    }

    return this.sortAdminAggregateRows([...rows.values()]);
  }

  private aggregateAdminPromoRows(usages: AdminReportUsage[]): AdminAggregateRow[] {
    const rows = new Map<string, AdminAggregateRow>();

    for (const usage of usages) {
      const promo = usage.promo_code;
      const key = String(promo.id);
      const row =
        rows.get(key) ??
        this.createAdminAggregateRow({
          key,
          id: promo.id,
          code: promo.code,
          name: promo.agent?.name ?? 'Без агента',
          login: promo.agent?.login ?? '',
          status: promo.status,
          creation_mode: promo.creation_mode,
        });

      this.addUsageToAggregateRow(row, usage);
      rows.set(key, row);
    }

    return this.sortAdminAggregateRows([...rows.values()]);
  }

  private createAdminAggregateRow(params: Partial<AdminAggregateRow> & { key: string }): AdminAggregateRow {
    return {
      key: params.key,
      id: params.id,
      name: params.name,
      login: params.login,
      code: params.code,
      status: params.status,
      creation_mode: params.creation_mode,
      usagesCount: 0,
      uniqueClientIds: new Set<number>(),
      grossAmount: 0,
      paidAmount: 0,
      discountAmount: 0,
      agentCreditAmount: 0,
    };
  }

  private addUsageToAggregateRow(row: AdminAggregateRow, usage: PromoReportUsage) {
    const paidAmount = Number(usage.transaction?.amount ?? 0);
    const discountAmount = usage.discount_amount ?? 0;
    const agentCreditAmount = usage.agent_credit_amount ?? 0;

    row.usagesCount += 1;
    row.uniqueClientIds.add(usage.user_id);
    row.paidAmount += paidAmount;
    row.discountAmount += discountAmount;
    row.grossAmount += paidAmount + discountAmount;
    row.agentCreditAmount += agentCreditAmount;
  }

  private sortAdminAggregateRows(rows: AdminAggregateRow[]) {
    return rows.sort((a, b) => b.agentCreditAmount - a.agentCreditAmount || b.paidAmount - a.paidAmount);
  }

  private formatAdminAggregateRow(row: AdminAggregateRow) {
    return {
      id: row.id ?? null,
      name: row.name ?? null,
      login: row.login ?? null,
      code: row.code ?? null,
      status: row.status ?? null,
      creation_mode: row.creation_mode ?? null,
      usages_count: row.usagesCount,
      unique_clients_count: row.uniqueClientIds.size,
      gross_sales_amount: this.toMajor(row.grossAmount),
      paid_amount: this.toMajor(row.paidAmount),
      client_discount_amount: this.toMajor(row.discountAmount),
      agent_credit_amount: this.toMajor(row.agentCreditAmount),
    };
  }

  private calculateAgentReportTotals(usages: PromoReportUsage[]): PromoReportTotals {
    return usages.reduce(
      (totals, usage) => {
        const paidAmount = Number(usage.transaction?.amount ?? 0);
        const discountAmount = usage.discount_amount ?? 0;
        const agentCreditAmount = usage.agent_credit_amount ?? 0;

        totals.paidAmount += paidAmount;
        totals.discountAmount += discountAmount;
        totals.grossAmount += paidAmount + discountAmount;
        totals.agentCreditAmount += agentCreditAmount;
        return totals;
      },
      {
        grossAmount: 0,
        paidAmount: 0,
        discountAmount: 0,
        agentCreditAmount: 0,
      },
    );
  }

  private formatAgentReportFilters(query: AgentPromoReportQueryDto) {
    return {
      date_from: query.date_from ?? null,
      date_to: query.date_to ?? null,
      promo_code: query.promo_code?.trim() ? this.normalizeSearch(query.promo_code) : null,
      status: query.status ?? PromoUsageStatus.CONFIRMED,
    };
  }

  private formatAdminReportFilters(query: AdminPromoReportQueryDto) {
    return {
      ...this.formatAgentReportFilters(query),
      agent_id: query.agent_id ?? null,
      agent_login: query.agent_login?.trim() || null,
      agent_name: query.agent_name?.trim() || null,
      client_email: query.client_email?.trim() || null,
      client_phone: query.client_phone?.trim() || null,
      transaction_id: query.transaction_id ?? null,
      order_id: query.order_id ?? null,
      creation_mode: query.creation_mode ?? null,
      promocode_status: query.promocode_status ?? null,
      transaction_status: query.transaction_status ?? null,
    };
  }

  private agentReportUsageInclude() {
    return {
      promo_code: {
        select: {
          id: true,
          code: true,
          creation_mode: true,
          status: true,
          created_at: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
        },
      },
      transaction: {
        select: {
          id: true,
          amount: true,
          status: true,
          created_at: true,
        },
      },
      order: {
        select: {
          id: true,
          status: true,
          created_at: true,
        },
      },
    } satisfies Prisma.PromoUsageInclude;
  }

  private adminReportUsageInclude() {
    return {
      promo_code: {
        select: {
          id: true,
          code: true,
          creation_mode: true,
          status: true,
          created_at: true,
          agent: {
            select: {
              id: true,
              name: true,
              login: true,
              status: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
        },
      },
      transaction: {
        select: {
          id: true,
          amount: true,
          status: true,
          created_at: true,
        },
      },
      order: {
        select: {
          id: true,
          status: true,
          created_at: true,
        },
      },
    } satisfies Prisma.PromoUsageInclude;
  }

  private buildAdminSummarySheet(
    workbook: ExcelJS.Workbook,
    filters: ReturnType<PromoCodeService['formatAdminReportFilters']>,
    usages: AdminReportUsage[],
    totals: PromoReportTotals,
    byAgent: AdminAggregateRow[],
    byPromoCode: AdminAggregateRow[],
  ) {
    const sheet = workbook.addWorksheet('Сводка');
    this.setupAdminSheetTitle(sheet, 'Сводка по промокодам');

    const infoRows = [
      ['Период', `${filters.date_from ?? 'Без ограничения'} - ${filters.date_to ?? 'Без ограничения'}`],
      ['Статус использования', filters.status],
      ['Промокод', filters.promo_code ?? 'Все'],
      ['Агент ID', filters.agent_id ?? 'Все'],
      ['Логин агента', filters.agent_login ?? 'Все'],
      ['Email клиента', filters.client_email ?? 'Все'],
      ['Сформировано', new Date()],
    ];

    infoRows.forEach((row, index) => {
      const rowNumber = index + 3;
      sheet.getCell(`A${rowNumber}`).value = row[0];
      sheet.getCell(`B${rowNumber}`).value = row[1] as any;
      sheet.getCell(`A${rowNumber}`).font = { bold: true };
    });
    sheet.getCell('B9').numFmt = 'dd.mm.yyyy hh:mm';

    const summaryRows = [
      ['Количество продаж', usages.length],
      ['Уникальные клиенты', new Set(usages.map((usage) => usage.user_id)).size],
      ['Агенты с продажами', byAgent.length],
      ['Промокоды с продажами', byPromoCode.length],
      ['Сумма до скидки', this.toMajor(totals.grossAmount)],
      ['Оплачено клиентами', this.toMajor(totals.paidAmount)],
      ['Скидка клиентам', this.toMajor(totals.discountAmount)],
      ['Начислено агентам', this.toMajor(totals.agentCreditAmount)],
    ];

    summaryRows.forEach((row, index) => {
      const rowNumber = index + 3;
      sheet.getCell(`D${rowNumber}`).value = row[0];
      sheet.getCell(`E${rowNumber}`).value = row[1] as any;
      sheet.getCell(`D${rowNumber}`).font = { bold: true };
      if (index >= 4) sheet.getCell(`E${rowNumber}`).numFmt = '#,##0.00';
    });

    this.addAdminAggregatePreview(sheet, 'Топ агенты', byAgent, 12);
    this.addAdminAggregatePreview(sheet, 'Топ промокоды', byPromoCode, 12, 8);

    sheet.columns = [
      { width: 22 },
      { width: 28 },
      { width: 4 },
      { width: 24 },
      { width: 18 },
      { width: 4 },
      { width: 4 },
      { width: 24 },
      { width: 18 },
    ];
  }

  private addAdminAggregatePreview(
    sheet: ExcelJS.Worksheet,
    title: string,
    rows: AdminAggregateRow[],
    startRow: number,
    startColumn = 1,
  ) {
    const titleCell = sheet.getCell(startRow, startColumn);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 13 };

    const header = ['Название', 'Продажи', 'Оплачено', 'Начислено'];
    const headerRow = sheet.getRow(startRow + 1);
    header.forEach((value, index) => {
      const cell = headerRow.getCell(startColumn + index);
      cell.value = value;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } };
      cell.border = this.excelBorder();
    });

    rows.slice(0, 8).forEach((row, index) => {
      const excelRow = sheet.getRow(startRow + 2 + index);
      const values = [
        row.code
          ? `${row.code} (${row.login || row.name || ''})`
          : `${row.name ?? ''} ${row.login ? `(${row.login})` : ''}`,
        row.usagesCount,
        this.toMajor(row.paidAmount),
        this.toMajor(row.agentCreditAmount),
      ];
      values.forEach((value, valueIndex) => {
        const cell = excelRow.getCell(startColumn + valueIndex);
        cell.value = value as any;
        cell.border = this.excelBorder();
        if (valueIndex >= 2) cell.numFmt = '#,##0.00';
      });
    });
  }

  private buildAdminSalesSheet(workbook: ExcelJS.Workbook, usages: AdminReportUsage[], totals: PromoReportTotals) {
    const sheet = workbook.addWorksheet('Продажи', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    this.setupAdminSheetTitle(sheet, 'Детализация продаж');

    const headers = [
      '№',
      'Дата оплаты',
      'Агент',
      'Логин агента',
      'Промокод',
      'Тип создания',
      'Статус промокода',
      'Клиент',
      'Email',
      'Телефон',
      'Transaction ID',
      'Transaction status',
      'Order ID',
      'Order status',
      'Сумма до скидки',
      'Оплачено клиентом',
      'Скидка клиенту',
      'Начислено агенту',
      'Статус использования',
    ];
    this.addExcelHeaderRow(sheet, headers, 2);

    usages.forEach((usage, index) => {
      const paidAmount = Number(usage.transaction?.amount ?? 0);
      const discountAmount = usage.discount_amount ?? 0;
      const row = sheet.addRow([
        index + 1,
        usage.confirmed_at ?? usage.created_at,
        usage.promo_code.agent?.name ?? '',
        usage.promo_code.agent?.login ?? '',
        usage.promo_code.code,
        usage.promo_code.creation_mode,
        usage.promo_code.status,
        usage.user?.name ?? '',
        usage.user?.email ?? '',
        usage.user?.phone_number ?? '',
        usage.transaction_id ?? '',
        usage.transaction?.status ?? '',
        usage.order_id ?? '',
        usage.order?.status ?? '',
        this.toMajor(paidAmount + discountAmount),
        this.toMajor(paidAmount),
        this.toMajor(discountAmount),
        this.toMajor(usage.agent_credit_amount),
        usage.status,
      ]);
      this.styleExcelDataRow(row, [15, 16, 17, 18], 2);
    });

    const totalRow = sheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Итого:',
      this.toMajor(totals.grossAmount),
      this.toMajor(totals.paidAmount),
      this.toMajor(totals.discountAmount),
      this.toMajor(totals.agentCreditAmount),
      '',
    ]);
    totalRow.font = { bold: true };
    this.styleExcelDataRow(totalRow, [15, 16, 17, 18]);

    sheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 24 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 24 },
      { width: 30 },
      { width: 18 },
      { width: 16 },
      { width: 20 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];
    this.applyAutoFilter(sheet, 2, headers.length);
  }

  private buildAdminAgentsSheet(workbook: ExcelJS.Workbook, rows: AdminAggregateRow[]) {
    const sheet = workbook.addWorksheet('Агенты', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    this.setupAdminSheetTitle(sheet, 'Итоги по агентам');
    const headers = [
      '№',
      'Agent ID',
      'Агент',
      'Логин',
      'Статус',
      'Продажи',
      'Уникальные клиенты',
      'Сумма до скидки',
      'Оплачено',
      'Скидка',
      'Начислено агенту',
    ];
    this.addExcelHeaderRow(sheet, headers, 2);
    rows.forEach((item, index) => {
      const row = sheet.addRow([
        index + 1,
        item.id ?? '',
        item.name ?? '',
        item.login ?? '',
        item.status ?? '',
        item.usagesCount,
        item.uniqueClientIds.size,
        this.toMajor(item.grossAmount),
        this.toMajor(item.paidAmount),
        this.toMajor(item.discountAmount),
        this.toMajor(item.agentCreditAmount),
      ]);
      this.styleExcelDataRow(row, [8, 9, 10, 11], 2);
    });
    sheet.columns = [
      { width: 8 },
      { width: 12 },
      { width: 24 },
      { width: 18 },
      { width: 14 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];
    this.applyAutoFilter(sheet, 2, headers.length);
  }

  private buildAdminPromoCodesSheet(workbook: ExcelJS.Workbook, rows: AdminAggregateRow[]) {
    const sheet = workbook.addWorksheet('Промокоды', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    this.setupAdminSheetTitle(sheet, 'Итоги по промокодам');
    const headers = [
      '№',
      'Promo ID',
      'Промокод',
      'Тип',
      'Статус',
      'Агент',
      'Логин агента',
      'Продажи',
      'Уникальные клиенты',
      'Сумма до скидки',
      'Оплачено',
      'Скидка',
      'Начислено агенту',
    ];
    this.addExcelHeaderRow(sheet, headers, 2);
    rows.forEach((item, index) => {
      const row = sheet.addRow([
        index + 1,
        item.id ?? '',
        item.code ?? '',
        item.creation_mode ?? '',
        item.status ?? '',
        item.name ?? '',
        item.login ?? '',
        item.usagesCount,
        item.uniqueClientIds.size,
        this.toMajor(item.grossAmount),
        this.toMajor(item.paidAmount),
        this.toMajor(item.discountAmount),
        this.toMajor(item.agentCreditAmount),
      ]);
      this.styleExcelDataRow(row, [10, 11, 12, 13], 2);
    });
    sheet.columns = [
      { width: 8 },
      { width: 12 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 24 },
      { width: 18 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
    ];
    this.applyAutoFilter(sheet, 2, headers.length);
  }

  private setupAdminSheetTitle(sheet: ExcelJS.Worksheet, title: string) {
    sheet.mergeCells('A1:S1');
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    sheet.getRow(1).height = 28;
  }

  private addExcelHeaderRow(sheet: ExcelJS.Worksheet, headers: string[], rowNumber: number) {
    const row = sheet.getRow(rowNumber);
    row.values = headers;
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.height = 32;
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } };
      cell.border = this.excelBorder();
    });
  }

  private styleExcelDataRow(row: ExcelJS.Row, moneyColumns: number[] = [], dateColumn?: number) {
    row.eachCell((cell) => {
      cell.border = this.excelBorder();
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    moneyColumns.forEach((columnNumber) => {
      row.getCell(columnNumber).numFmt = '#,##0.00';
    });
    if (dateColumn) row.getCell(dateColumn).numFmt = 'dd.mm.yyyy hh:mm';
  }

  private applyAutoFilter(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number) {
    sheet.autoFilter = {
      from: { row: rowNumber, column: 1 },
      to: { row: rowNumber, column: columnCount },
    };
  }

  private excelBorder(): Partial<ExcelJS.Borders> {
    return {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  }

  private async getUserBasketTotal(userId: number) {
    const basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
      select: {
        items: {
          select: {
            price: true,
            quantity: true,
          },
        },
      },
    });

    const total = basket?.items?.reduce((sum, item) => sum + Number(item.price ?? 0) * item.quantity, 0) ?? 0;
    if (total <= 0) {
      throw new BadRequestException('Корзина пуста!');
    }
    return total;
  }

  private async getOrCreateSettings() {
    const settings = await this.prisma.promoSettings.findUnique({ where: { id: 1 } });
    if (settings) return settings;

    return this.prisma.promoSettings.create({
      data: { id: 1 },
    });
  }

  private async getCachedSettings(): Promise<EffectivePromoSettings> {
    if (this.settingsCache && this.settingsCache.expiresAt > Date.now()) return this.settingsCache.value;
    const settings = await this.getOrCreateSettings();
    const value = {
      client_discount_amount: settings.default_client_discount_amount ?? DEFAULT_PROMO_SETTINGS.client_discount_amount,
      agent_credit_amount: settings.default_agent_credit_amount ?? DEFAULT_PROMO_SETTINGS.agent_credit_amount,
      is_creation_enabled: settings.is_agent_creation_enabled ?? DEFAULT_PROMO_SETTINGS.is_creation_enabled,
      creation_mode: settings.agent_creation_mode ?? DEFAULT_PROMO_SETTINGS.creation_mode,
      allow_limit_once: settings.allow_limit_once ?? DEFAULT_PROMO_SETTINGS.allow_limit_once,
      allow_limit_unlimited: settings.allow_limit_unlimited ?? DEFAULT_PROMO_SETTINGS.allow_limit_unlimited,
      allow_limit_custom: settings.allow_limit_custom ?? DEFAULT_PROMO_SETTINGS.allow_limit_custom,
      allow_no_expiry: settings.allow_no_expiry ?? DEFAULT_PROMO_SETTINGS.allow_no_expiry,
      allow_expires_at: settings.allow_expires_at ?? DEFAULT_PROMO_SETTINGS.allow_expires_at,
    };
    this.settingsCache = { value, expiresAt: Date.now() + this.cacheTtlMs };
    return value;
  }

  private clearCache() {
    this.settingsCache = undefined;
  }

  private assertAgentCanCreate(
    settings: EffectivePromoSettings,
    creationMode: PromoCodeCreationMode,
    limitType: PromoLimitType,
    expiresAt?: string,
  ) {
    if (!settings.is_creation_enabled) {
      throw new ForbiddenException('Создание промокодов для агента запрещено!');
    }

    if (settings.creation_mode === PromoCodeCreationMode.AUTO && creationMode === PromoCodeCreationMode.MANUAL) {
      throw new ForbiddenException('Агент может создавать только автосгенерированные промокоды!');
    }

    if (settings.creation_mode === PromoCodeCreationMode.MANUAL && creationMode === PromoCodeCreationMode.AUTO) {
      throw new ForbiddenException('Агент может создавать только ручные промокоды!');
    }

    if (limitType === PromoLimitType.ONCE && !settings.allow_limit_once) {
      throw new ForbiddenException('Одноразовый лимит для агента запрещен!');
    }

    if (limitType === PromoLimitType.UNLIMITED && !settings.allow_limit_unlimited) {
      throw new ForbiddenException('Безлимитное использование для агента запрещено!');
    }

    if (limitType === PromoLimitType.CUSTOM && !settings.allow_limit_custom) {
      throw new ForbiddenException('Пользовательский лимит для агента запрещен!');
    }

    if (expiresAt && !settings.allow_expires_at) {
      throw new ForbiddenException('Дата окончания для агента запрещена!');
    }

    if (!expiresAt && !settings.allow_no_expiry) {
      throw new ForbiddenException('Бессрочный промокод для агента запрещен!');
    }
  }

  private resolveAgentCreationMode(data: CreateAgentPromoCodeDto) {
    if (!data.creation_mode) {
      return data.code ? PromoCodeCreationMode.MANUAL : PromoCodeCreationMode.AUTO;
    }

    if (data.creation_mode === PromoCodeRequestCreationMode.MANUAL) {
      if (!data.code?.trim()) {
        throw new BadRequestException('Укажите промокод для ручного создания!');
      }
      return PromoCodeCreationMode.MANUAL;
    }

    if (data.code?.trim()) {
      throw new BadRequestException('Для автогенерации промокод не передается!');
    }

    return PromoCodeCreationMode.AUTO;
  }

  private resolveUsageLimit(limitType: PromoLimitType, usageLimit?: number) {
    if (limitType === PromoLimitType.ONCE) return 1;
    if (limitType === PromoLimitType.UNLIMITED) return null;
    if (!usageLimit || usageLimit < 1) {
      throw new BadRequestException('Укажите корректный лимит использования!');
    }
    return usageLimit;
  }

  private async ensureAgent(agentId: number) {
    const agent = await this.prisma.staff.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        status: true,
      },
    });

    if (!agent || agent.status !== Status.ACTIVE || agent.role !== UserRoles.AGENT) {
      throw new NotFoundException('Агент не найден или неактивен!');
    }
    return agent;
  }

  private async ensureCodeIsAvailable(code: string) {
    const exists = await this.prisma.promoCode.findUnique({
      where: { code },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException('Промокод уже существует!');
    }
  }

  private async generateUniqueCode(length = 8) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 30; attempt++) {
      const bytes = crypto.randomBytes(length);
      const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
      const exists = await this.prisma.promoCode.findUnique({ where: { code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new ConflictException('Не удалось сгенерировать уникальный промокод!');
  }

  private normalizeCode(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,32}$/.test(normalized)) {
      throw new BadRequestException('Промокод должен содержать латинские буквы и цифры, 4-32 символа!');
    }
    return normalized;
  }

  private normalizeSearch(search: string) {
    return search.trim().toUpperCase();
  }

  private toMinor(value: number) {
    return Math.round(Number(value) * 100);
  }

  private toMajor(value: number | null) {
    if (value == null) return null;
    return Number((value / 100).toFixed(2));
  }

  private hasOwn(obj: object, key: string) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  private promoCodeInclude() {
    return {
      agent: {
        select: {
          id: true,
          name: true,
          login: true,
          role: true,
        },
      },
      created_by_staff: {
        select: {
          id: true,
          name: true,
          login: true,
          role: true,
        },
      },
      _count: {
        select: {
          usages: true,
        },
      },
    } satisfies Prisma.PromoCodeInclude;
  }

  private formatSettings(settings: Awaited<ReturnType<PrismaService['promoSettings']['findUnique']>>) {
    if (!settings) return null;
    return {
      ...settings,
      default_client_discount_amount: this.toMajor(settings.default_client_discount_amount),
      default_agent_credit_amount: this.toMajor(settings.default_agent_credit_amount),
    };
  }

  private formatEffectiveSettings(settings: EffectivePromoSettings) {
    return {
      ...settings,
      client_discount_amount: this.toMajor(settings.client_discount_amount),
      agent_credit_amount: this.toMajor(settings.agent_credit_amount),
    };
  }

  private formatPromoCode(
    promo: Prisma.PromoCodeGetPayload<{ include: ReturnType<PromoCodeService['promoCodeInclude']> }>,
  ) {
    return {
      ...promo,
      client_discount_amount: this.toMajor(promo.client_discount_amount),
      agent_credit_amount: this.toMajor(promo.agent_credit_amount),
      agent: promo.agent
        ? {
            ...promo.agent,
          }
        : null,
      created_by_staff: promo.created_by_staff
        ? {
            ...promo.created_by_staff,
          }
        : null,
    };
  }

  private getMeta(totalItems: number, page: number, size: number) {
    const totalPage = Math.ceil(totalItems / size);
    return {
      totalPage,
      totalSize: size,
      currentPage: page,
      hasNextPage: page < totalPage,
      hasPreviousPage: page > 1,
      totalItems,
    };
  }
}
