import { ProviderExchange, ProviderTrace, sanitizeProviderData } from '../../http/provider-diagnostics';
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { PartnerIds } from '@enums';
import { BillionConnectService, JoyTel } from '@http';
import { SkyBlueService } from '../../http/skyblue.gateway';
import { normalizeBc, normalizeJoytel, normalizeMobiline, selectBcPlan, UsageResult } from './usage.normalizer';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly diagnostics = new Map<
    number,
    { checked_at: string; provider: string; exchanges: ProviderExchange[]; error?: string }
  >();
  private readonly inFlight = new Map<number, Promise<UsageResult>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly joytel: JoyTel,
    private readonly bc: BillionConnectService,
    private readonly skyblue: SkyBlueService,
  ) {}
  async forSim(
    id: number,
    userId?: number,
    includeDiagnostics = false,
  ): Promise<UsageResult & { diagnostics?: unknown }> {
    try {
      const result = await this.load(id, userId);
      if (!includeDiagnostics) return result;
      return {
        ...result,
        diagnostics: this.diagnostics.get(id) ?? {
          checked_at: result.status === 'ok' ? result.data.checked_at : new Date().toISOString(),
          source: result.status === 'ok' ? 'saved_snapshot' : result.status,
          exchanges: [],
          note:
            result.status === 'ok'
              ? 'Ответ взят из сохранённого баланса; повторный запрос доступен через 60 секунд.'
              : 'Запрос поставщику не отправлялся: eSIM ещё не готова или поставщик не поддерживается.',
        },
      };
    } catch (error) {
      if (includeDiagnostics && error instanceof BadGatewayException) {
        throw new BadGatewayException({ ...(error.getResponse() as object), diagnostics: this.diagnostics.get(id) });
      }
      throw error;
    }
  }

  private async load(id: number, userId?: number): Promise<UsageResult> {
    // Ownership is checked even on cache hits and coalesced requests.
    const sim = await this.prisma.sims.findFirst({
      where: { id, ...(userId === undefined ? {} : { user_id: userId }) },
      include: { partner: true, tariff: true },
    });
    if (!sim) throw new NotFoundException('SIM not found');
    if (![1, 2, 3].includes(sim.partner.identified_number ?? 0)) return { status: 'unsupported' };
    if (sim.status !== 'COMPLETED') return { status: 'not_ready' };
    if (sim.usage_snapshot && sim.usage_checked_at && Date.now() - sim.usage_checked_at.getTime() < 60000) {
      return { status: 'ok', data: sim.usage_snapshot as any };
    }
    const pending = this.inFlight.get(id);
    if (pending) return pending;
    const request = this.refresh(sim).finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, request);
    return request;
  }
  private async refresh(sim: any): Promise<UsageResult> {
    const report = {
      checked_at: new Date().toISOString(),
      provider: { 1: 'Joytel', 2: 'BillionConnect', 3: 'Mobiline / SkyBlue' }[sim.partner.identified_number] as string,
      exchanges: [] as ProviderExchange[],
      error: undefined as string | undefined,
    };
    const trace: ProviderTrace = (exchange) => {
      if (report.exchanges.length < 20) report.exchanges.push(sanitizeProviderData(exchange));
    };
    try {
      let usage;
      switch (sim.partner.identified_number) {
        case PartnerIds.JOYTEL: {
          const coupon = sim.coupon || sim.sn_pin;
          if (!coupon) return { status: 'not_ready' };
          usage = normalizeJoytel(await this.joytel.getUsageResponse({ coupon }, trace), sim.tariff);
          break;
        }
        case PartnerIds.BILLION_CONNECT: {
          if (!sim.iccid) return { status: 'not_ready' };
          const plans = await this.bc.getPlans(sim.iccid, trace);
          const plan = selectBcPlan(plans, sim.sub_order_id);
          const orders = plans.tradeData ?? [];
          const owner = orders.find((o: any) =>
            o.subOrderList?.some((p: any) => String(p.subOrderId) === String(plan.subOrderId)),
          );
          let use;
          try {
            use = await this.bc.getUsage({ iccid: sim.iccid, orderId: sim.partner_order_id || owner?.orderId }, trace);
          } catch {
            use = null;
          } // F012 may still contain a valid usedTraffic counter.
          usage = normalizeBc(plans, use, sim);
          break;
        }
        case PartnerIds.MOBILINE:
          if (!sim.iccid) return { status: 'not_ready' };
          usage = normalizeMobiline(await this.skyblue.getEsimDetail(sim.iccid, trace), sim);
          break;
        default:
          return { status: 'unsupported' };
      }
      const simStatus =
        usage.state === 'not_activated'
          ? undefined
          : usage.state === 'expired'
            ? ('EXPIRED' as const)
            : ('ACTIVATED' as const);
      await this.prisma.sims.update({
        where: { id: sim.id },
        data: {
          usage_snapshot: usage as any,
          usage_checked_at: new Date(usage.checked_at),
          last_usage_quantity: String(usage.used_mb),
          ...(simStatus ? { sim_status: simStatus } : {}),
        },
      });
      return { status: 'ok', data: usage };
    } catch (error) {
      report.error = sanitizeProviderData(
        error?.isAxiosError
          ? error.code || 'Provider request failed'
          : typeof error?.getResponse === 'function'
            ? 'Provider request failed (see response)'
            : error?.message || 'Balance check failed',
      );
      this.logger.warn({ event: 'provider_usage_failed', sim_id: sim.id, ...report });
      throw new BadGatewayException({
        success: false,
        message: 'Balance is temporarily unavailable',
        last_success: sim.usage_snapshot ? { status: 'ok', data: sim.usage_snapshot } : null,
      });
    } finally {
      // Bounded in-process diagnostic cache; never added to customer-visible snapshots.
      this.diagnostics.delete(sim.id);
      this.diagnostics.set(sim.id, report);
      if (this.diagnostics.size > 200) this.diagnostics.delete(this.diagnostics.keys().next().value);
    }
  }
}
