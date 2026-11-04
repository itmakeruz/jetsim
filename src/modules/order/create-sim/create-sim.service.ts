import { MAIL_USER } from '@config';
import { PartnerIds } from '@enums';
import { BillionConnectService, JoyTel, ProviderRequestError } from '@http';
import { WinstonLoggerService } from '@logger';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { OrderStatus } from '@prisma/client';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';
import { OrderEventsService } from 'src/modules/order-events/order-events.service';
import type { SubmitOutcome } from '../../b2b/issuance/provider-submitter';

@Injectable()
export class CreateSimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joyTel: JoyTel,
    private readonly logger: WinstonLoggerService,
    private readonly billionConnect: BillionConnectService,
    private readonly telegramBotService: TelegramBotService,
    private readonly orderEvents: OrderEventsService,
  ) {}

  async processJoyTel(order_id: number, user_id: number, item: any) {
    const claimed = await this.claimSim(item.id);
    if (!claimed) {
      return true;
    }

    let providerResponse: any;

    await this.orderEvents.record({
      simId: item.id,
      orderId: order_id,
      partnerId: item.partner_id ?? PartnerIds.JOYTEL,
      event: 'joytel_submit_requested',
      message: 'Заявка на выпуск eSIM отправлена в JoyTel (/customerApi/customerOrder)',
    });

    try {
      const response = await this.callJoyTel(item);
      this.logger.log('JT INIT ORDER RESPONSE: ', response);
      console.log(response);

      if (response?.code !== 0) {
        providerResponse = response;
        throw new Error(response?.message ?? response?.mesg ?? 'JoyTel order request failed');
      }

      await this.onJoyTelAccepted(order_id, item, response);

      return true;
    } catch (e) {
      const errorResponse = this.normalizeProviderError(e, providerResponse);
      await this.failSim(
        item.id,
        order_id,
        errorResponse,
        item.partner_id ?? PartnerIds.JOYTEL,
        'joytel_submit_failed',
      );
      return false;
    }
  }

  /** Единственное место, где уходит заявка в JoyTel — общее для розницы и B2B */
  private callJoyTel(item: any) {
    return this.joyTel.submitEsimOrder(item.id, 'Jetsim User', 'string', MAIL_USER, item.tariff.sku_id, 1);
  }

  /** Поставщик принял заявку: фиксируем, уведомляем, пробуем сразу получить snPin (общее для розницы и B2B) */
  private async onJoyTelAccepted(order_id: number, item: any, response: any) {
    await this.prisma.sims.update({
      where: {
        id: item.id,
      },
      data: {
        order_tid: response.data.orderTid,
        order_code: response.data.orderCode,
        status: OrderStatus.REDEEM_COUPON,
        response,
        updated_at: new Date(),
      },
    });

    await this.orderEvents.record({
      simId: item.id,
      orderId: order_id,
      partnerId: item.partner_id ?? PartnerIds.JOYTEL,
      event: 'joytel_submit_succeeded',
      message: 'JoyTel принял заказ',
      meta: { orderTid: response.data.orderTid, orderCode: response.data.orderCode, code: response.code },
    });

    await this.telegramBotService.notifyOrderSuccess({
      partnerId: item.partner_id ?? PartnerIds.JOYTEL,
      orderId: order_id,
      esimId: item.id,
      date: new Date().toISOString(),
      client: {
        name: item.user?.name ?? '—',
        email: item.user?.email ?? '—',
      },
      tradeCode: response?.data?.orderCode,
      providerOrderId: response?.data?.orderTid,
      response,
    });

    // Не ждём пассивно колбэк JoyTel на /order/joytel/callback — сразу же
    // спрашиваем статус сами. Если snPin уже готов на их стороне, выигрываем
    // время до QR: не нужно дожидаться, пока их очередь решит прислать вебхук.
    // Если не готов — ничего не делаем, дальше сработает обычный колбэк.
    // Любая ошибка здесь проглатывается: это ускоряющая попытка, а не
    // обязательный шаг, основной путь выдачи остаётся прежним.
    await this.tryProactiveJoyTelQuery(
      item.id,
      order_id,
      response.data.orderTid,
      response.data.orderCode,
      item.partner_id ?? PartnerIds.JOYTEL,
    );
  }

  private async tryProactiveJoyTelQuery(
    simId: number,
    orderId: number,
    orderTid: string,
    orderCode: string,
    partnerId = PartnerIds.JOYTEL,
  ) {
    try {
      const statusResponse = await this.joyTel.queryOrderStatus(orderTid, orderCode);

      const items = statusResponse?.data?.itemList ?? [];
      const snList = items.flatMap((item) => item?.snList ?? []).filter(Boolean);

      if (snList.length === 0) {
        await this.orderEvents.record({
          simId,
          orderId,
          partnerId,
          event: 'joytel_snpin_query_pending',
          message: 'JoyTel ещё не выдал snPin на момент проверки — ждём колбэк',
        });
        return;
      }

      const firstSn = snList[0];
      const productCode = items[0]?.productCode;

      // Тот же атомарный захват, что и в OrderService.redeemCoupon: кто первый
      // дошёл до БД (мы здесь или колбэк), тот и запрашивает QR.
      const claimed = await this.prisma.sims.updateMany({
        where: { id: simId, status: OrderStatus.REDEEM_COUPON },
        data: {
          sn_code: firstSn.snCode,
          sn_pin: firstSn.snPin,
          sn_puk: firstSn.snPuk || null,
          pin_1: firstSn.snPin,
          puk_1: firstSn.snPuk || null,
          uid: firstSn.snCode,
          product_code: productCode,
          status: OrderStatus.NOTIFY_COUPON,
        },
      });

      if (claimed.count === 0) {
        await this.orderEvents.record({
          simId,
          orderId,
          partnerId,
          event: 'joytel_snpin_query_raced_callback',
          message: 'Колбэк JoyTel уже применил snPin раньше проактивного запроса — пропускаем повтор',
        });
        return;
      }

      await this.orderEvents.record({
        simId,
        orderId,
        partnerId,
        event: 'joytel_snpin_query_succeeded',
        message: 'snPin получен проактивным запросом статуса, не дожидаясь колбэка',
      });

      await this.joyTel.redeemCouponForQrCode(firstSn.snPin);
      await this.orderEvents.record({
        simId,
        orderId,
        partnerId,
        event: 'joytel_qr_requested',
        message: 'Запрос QR отправлен в JoyTel (/coupon/redeem) — по итогам проактивной проверки',
      });
    } catch (error) {
      await this.orderEvents.record({
        simId,
        orderId,
        partnerId,
        event: 'joytel_snpin_query_failed',
        severity: 'warning',
        message: error?.message ?? String(error),
      });
    }
  }

  async processBillion(order_id: number, user_id: number, item) {
    const claimed = await this.claimSim(item.id);
    if (!claimed) {
      return true;
    }

    let providerResponse: any;

    await this.orderEvents.record({
      simId: item.id,
      orderId: order_id,
      partnerId: item.partner_id ?? PartnerIds.BILLION_CONNECT,
      event: 'billionconnect_submit_requested',
      message: 'Заявка на выпуск eSIM отправлена в BillionConnect',
    });

    try {
      const response = await this.callBillion(item);
      console.log(response);

      this.logger.log('BC INIT ORDER RESPONSE: ', response);

      if (response?.tradeCode !== '1000' || response?.tradeData?.successFlag !== 'true') {
        providerResponse = response;
        throw new Error(response?.tradeMsg ?? 'BillionConnect order request failed');
      }

      await this.onBillionAccepted(order_id, item, response);

      return true;
    } catch (e) {
      const errorResponse = this.normalizeProviderError(e, providerResponse);
      console.log(errorResponse);
      await this.failSim(
        item.id,
        order_id,
        errorResponse,
        item.partner_id ?? PartnerIds.BILLION_CONNECT,
        'billionconnect_submit_failed',
      );
      return false;
    }
  }

  /** Единственное место, где уходит заявка в BillionConnect — общее для розницы и B2B */
  private callBillion(item: any) {
    const fiksirovanniy_sku_ids = ['1756107340691234', '1768370171837992', '1768370171830991'];

    const isFiksirovanniySkuId = fiksirovanniy_sku_ids?.includes(item?.tariff?.sku_id);
    return this.billionConnect.createEsimOrder({
      channelOrderId: item.id.toString(),
      email: item.user?.email || undefined,
      subOrderList: [
        {
          channelSubOrderId: item.id.toString(),
          deviceSkuId: item.tariff.sku_id,
          planSkuCopies: isFiksirovanniySkuId ? '1' : item?.tariff?.validity_period?.toString(),
          number: '1',
        },
      ],
    });
  }

  private async onBillionAccepted(order_id: number, item: any, response: any) {
    await this.prisma.sims.update({
      where: { id: item.id },
      data: {
        status: OrderStatus.NOTIFY_COUPON,
        partner_order_id: response.tradeData.orderId,
        response,
        updated_at: new Date(),
      },
    });

    await this.orderEvents.record({
      simId: item.id,
      orderId: order_id,
      partnerId: item.partner_id ?? PartnerIds.BILLION_CONNECT,
      event: 'billionconnect_submit_succeeded',
      message: 'BillionConnect принял заказ, ждём финальный колбэк',
      meta: { orderId: response.tradeData.orderId, tradeCode: response.tradeCode },
    });

    await this.telegramBotService.notifyOrderSuccess({
      partnerId: item.partner_id ?? PartnerIds.BILLION_CONNECT,
      orderId: order_id,
      esimId: item.id,
      date: new Date().toISOString(),
      client: {
        name: item.user?.name ?? '—',
        email: item.user?.email ?? '—',
      },
      tradeCode: response?.tradeCode,
      providerOrderId: response?.tradeData?.orderId,
      response,
    });
  }

  // ---------------------------------------------------------------------------
  // B2B: тот же вызов поставщика, но с различением исхода (см. ProviderSubmitter).
  // В отличие от processJoyTel/processBillion здесь неизвестный исход (таймаут,
  // обрыв, 5xx) НЕ превращается в FAILED: заявка могла дойти, и повторно её
  // отправлять нельзя — резерв денег держится до сверки.
  // ---------------------------------------------------------------------------

  async submitJoyTelForB2b(order_id: number, item: any): Promise<SubmitOutcome> {
    return this.submitForB2b(order_id, item, PartnerIds.JOYTEL, 'joytel', async () => {
      const response = await this.callJoyTel(item);
      if (response?.code !== 0) {
        return { rejected: response, reason: response?.message ?? response?.mesg ?? 'JoyTel отклонил заказ' };
      }
      await this.onJoyTelAccepted(order_id, item, response);
      return { accepted: response };
    });
  }

  async submitBillionForB2b(order_id: number, item: any): Promise<SubmitOutcome> {
    return this.submitForB2b(order_id, item, PartnerIds.BILLION_CONNECT, 'billionconnect', async () => {
      const response = await this.callBillion(item);
      if (response?.tradeCode !== '1000' || response?.tradeData?.successFlag !== 'true') {
        return { rejected: response, reason: response?.tradeMsg ?? 'BillionConnect отклонил заказ' };
      }
      await this.onBillionAccepted(order_id, item, response);
      return { accepted: response };
    });
  }

  private async submitForB2b(
    order_id: number,
    item: any,
    defaultPartner: PartnerIds,
    prefix: string,
    run: () => Promise<{ accepted: any } | { rejected: any; reason: string }>,
  ): Promise<SubmitOutcome> {
    const partnerId = item.partner_id ?? defaultPartner;
    if (!(await this.claimSim(item.id))) {
      return { kind: 'UNKNOWN', reason: 'SIM уже была взята в работу — повторная отправка не выполняется' };
    }
    await this.orderEvents.record({
      simId: item.id,
      orderId: order_id,
      partnerId,
      event: `${prefix}_submit_requested`,
      message: `Заявка на выпуск eSIM отправлена поставщику (B2B)`,
    });

    try {
      const result = await run();
      if ('accepted' in result) return { kind: 'ACCEPTED', response: result.accepted };
      await this.failSim(item.id, order_id, result.rejected, partnerId, `${prefix}_submit_failed`);
      return { kind: 'REJECTED', reason: result.reason, response: result.rejected };
    } catch (e: any) {
      const outcome = this.classifySubmitError(e);
      if (outcome.kind === 'REJECTED') {
        await this.failSim(item.id, order_id, this.normalizeProviderError(e), partnerId, `${prefix}_submit_failed`);
        return outcome;
      }
      // Неизвестный исход: SIM остаётся в PENDING, ничего не освобождаем и не повторяем
      await this.orderEvents.record({
        simId: item.id,
        orderId: order_id,
        partnerId,
        event: `${prefix}_submit_unknown`,
        severity: 'warning',
        message: 'Результат заявки неизвестен; автоматического повтора нет — нужна сверка',
        meta: { error: e?.message },
      });
      return outcome;
    }
  }

  /** Достоверный отказ — только HTTP 4xx поставщика; всё остальное (нет ответа, 5xx, сбой кода) — неизвестно. */
  classifySubmitError(e: any): SubmitOutcome {
    const status = e instanceof ProviderRequestError ? e.providerStatus : undefined;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return { kind: 'REJECTED', reason: `HTTP ${status}: ${e.message}`.slice(0, 300), response: (e as ProviderRequestError).providerBody };
    }
    return { kind: 'UNKNOWN', reason: String(e?.message ?? e).slice(0, 300) };
  }

  private async claimSim(simId: number) {
    const claimed = await this.prisma.sims.updateMany({
      where: {
        id: simId,
        status: OrderStatus.CREATED,
      },
      data: {
        status: OrderStatus.PENDING,
        updated_at: new Date(),
      },
    });

    return claimed.count === 1;
  }

  private normalizeProviderError(error: any, response?: any) {
    if (response) {
      return response;
    }

    return {
      name: error?.name ?? 'ProviderError',
      message: error?.message ?? String(error ?? 'Unknown provider error'),
      code: error?.code ?? error?.response?.status ?? null,
      details: error?.response?.data ?? null,
    };
  }

  private async failSim(simId: number, orderId: number, response: any, partnerId: number, event: string) {
    const sim = await this.prisma.sims.update({
      where: {
        id: simId,
      },
      data: {
        status: OrderStatus.FAILED,
        response: response,
        updated_at: new Date(),
      },
      select: {
        id: true,
        order_id: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    await this.orderEvents.record({
      simId,
      orderId,
      partnerId,
      event,
      severity: 'error',
      message: response?.tradeMsg ?? response?.message ?? response?.mesg ?? 'Провайдер отклонил заказ',
      meta: response,
    });

    await this.telegramBotService.notifyOrderError({
      partnerId: partnerId,
      orderId: sim.order_id,
      esimId: sim.id,
      date: new Date().toISOString(),
      client: {
        name: sim.user.name,
        email: sim.user.email,
      },
      errorCode: response?.tradeCode ?? response?.code ?? 'PROVIDER_ERROR',
      providerOrderId: response?.tradeData?.orderId,
      response,
    });

    this.logger.error('SIM_FAILED', {
      simId,
      partnerId,
      response,
    });
  }
}
