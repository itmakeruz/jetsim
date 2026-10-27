import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { PartnerIds } from '@enums';
import { QrService, saveQrCode } from '@helpers';
import { MobilineService } from '../../http/mobiline.gateway';
import { TelegramBotService } from '../../common/helpers/telegram-bot.service';
import { OrderEventSeverity, OrderEventsService } from '../order-events/order-events.service';
import { GatewayGateway } from '../gateway';
import { MobilineCallbackDto } from './dto/mobiline-callback.dto';

@Injectable()
export class MobilineActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: MobilineService,
    private readonly events: OrderEventsService,
    private readonly qr: QrService,
    private readonly telegram: TelegramBotService,
    private readonly socket: GatewayGateway,
  ) {}
  private async record(sim: any, event: string, message: string, severity: OrderEventSeverity = 'info', meta?: any) {
    await this.events.record({
      simId: sim.id,
      orderId: sim.order_id,
      partnerId: sim.partner_id,
      event,
      message,
      severity,
      meta,
    });
  }
  async submit(orderId: number, item: any): Promise<boolean> {
    let payload: ReturnType<MobilineService['buildActivation']>;
    try {
      payload = this.client.buildActivation(item.id, item.tariff.sku_id, item.tariff.validity_period);
    } catch {
      const failed = await this.prisma.sims.updateMany({
        where: { id: item.id, status: 'CREATED' },
        data: { status: 'FAILED' },
      });
      if (failed.count)
        await this.record(
          { ...item, order_id: orderId },
          'mobiline_submit_failed',
          'Mobiline: проверьте настройки и тариф',
          'error',
        );
      return false;
    }
    const claimed = await this.prisma.sims.updateMany({
      where: { id: item.id, status: 'CREATED' },
      data: {
        status: 'PENDING',
        channel_order_id: payload.channel_order_id,
        request: payload,
      },
    });
    if (!claimed.count) return true;
    const sim = { ...item, order_id: orderId };
    await this.record(sim, 'mobiline_submit_requested', 'Заявка на eSIM отправляется в Mobiline', 'info', payload);
    let response: any;
    try {
      response = await this.client.activate(payload);
    } catch {
      // No automatic resubmission: the provider may already have charged/issued the eSIM.
      await this.record(
        sim,
        'mobiline_submit_unknown',
        'Результат заявки Mobiline неизвестен; ждём callback, нужна проверка оператором',
        'warning',
      );
      return true;
    }
    const accepted = String(response.ret) === '0';
    const updated = await this.prisma.sims.updateMany({
      where: { id: item.id, status: 'PENDING' },
      data: {
        status: accepted ? 'NOTIFY_COUPON' : 'FAILED',
        response,
        ...(response.data?.application_id ? { partner_order_id: String(response.data.application_id) } : {}),
      },
    });
    await this.record(
      sim,
      accepted ? 'mobiline_submit_succeeded' : 'mobiline_submit_failed',
      accepted ? 'Mobiline принял заявку — ждём callback' : 'Mobiline отклонил заявку',
      accepted ? 'info' : 'error',
      response,
    );
    if (accepted && !response.data?.application_id)
      await this.record(sim, 'mobiline_application_id_missing', 'Mobiline принял заявку без application_id', 'warning');
    if (updated.count) {
      try {
        const params = {
          partnerId: PartnerIds.MOBILINE,
          orderId,
          esimId: item.id,
          date: new Date().toISOString(),
          client: { name: item.user?.name ?? '—', email: item.user?.email ?? '—' },
          response,
          providerOrderId: response.data?.application_id,
        };
        if (accepted) await this.telegram.notifyOrderSuccess({ ...params, tradeCode: response.ret });
        else await this.telegram.notifyOrderError({ ...params, errorCode: response.ret });
      } catch {
        await this.record(sim, 'mobiline_notification_failed', 'Не удалось отправить уведомление о заявке', 'warning');
      }
    }
    // An early callback may have already committed the final result.
    const current = await this.prisma.sims.findUnique({ where: { id: item.id }, select: { status: true } });
    return current?.status !== 'FAILED';
  }
  async callback(body: MobilineCallbackDto) {
    const sim = await this.prisma.sims.findFirst({
      where: {
        channel_order_id: body.channel_order_id,
        partner: { identified_number: PartnerIds.MOBILINE },
      },
      include: { user: true, tariff: true },
    });
    if (!sim) throw new NotFoundException('Mobiline activation not found');
    if (sim.status === 'COMPLETED' || sim.status === 'FAILED') {
      await this.record(sim, 'mobiline_callback_duplicate', 'Повторный или противоречивый callback Mobiline пропущен');
      return { success: true };
    }
    const success = String(body.ret) === '0';
    const d = body.data;
    if (success && (d?.product_type_cd !== 'ESIM' || !d.cid?.trim() || !d.qrcode?.trim())) {
      await this.record(sim, 'mobiline_callback_invalid', 'Callback Mobiline не содержит ICCID/QR для eSIM', 'error');
      throw new UnprocessableEntityException('Mobiline callback has no usable eSIM data');
    }
    const result = await this.prisma.sims.updateMany({
      where: { id: sim.id, status: { in: ['PENDING', 'NOTIFY_COUPON'] } },
      data: {
        status: success ? 'COMPLETED' : 'FAILED',
        response: body as any,
        ...(body.application_id ? { partner_order_id: body.application_id } : {}),
        ...(success
          ? {
              iccid: d!.cid,
              cid: d!.cid,
              qrcode: d!.qrcode,
              qrcode_type: 0,
              pin_1: d!.pin1,
              pin_2: d!.pin2,
              puk_1: d!.puk1,
              puk_2: d!.puk2,
            }
          : {}),
      },
    });
    if (!result.count) return { success: true };
    await this.record(
      sim,
      success ? 'mobiline_callback_received' : 'mobiline_callback_failed',
      success ? 'Mobiline прислал ICCID и QR — eSIM выдана' : 'Mobiline сообщил об ошибке выпуска eSIM',
      success ? 'info' : 'error',
      body,
    );
    if (!success) {
      try {
        await this.telegram.notifyOrderError({
          partnerId: PartnerIds.MOBILINE,
          orderId: sim.order_id!,
          esimId: sim.id,
          date: new Date().toISOString(),
          client: { name: sim.user.name ?? '—', email: sim.user.email ?? '—' },
          errorCode: body.ret,
          response: body,
        });
      } catch {
        await this.record(sim, 'mobiline_notification_failed', 'Не удалось отправить уведомление об отказе', 'warning');
      }
      return { success: true };
    }
    // Each side effect is isolated: a socket outage must not suppress the QR notification.
    const tasks = [
      async () => this.socket.sendOrderMessage(sim.user_id, sim.id, d!.qrcode!),
      async () => {
        const buffer = await this.qr.generateQrWithLogo(d!.qrcode!);
        try {
          saveQrCode(sim.id, buffer);
        } catch {
          await this.record(
            sim,
            'mobiline_callback_post_processing_failed',
            'Не удалось сохранить файл QR; eSIM выдана',
            'warning',
          );
        }
        await this.telegram.notifySimActivated({
          orderId: sim.order_id!,
          esimId: sim.id,
          date: new Date().toISOString(),
          client: {
            name: sim.user.name ?? '—',
            email: sim.user.email ?? '—',
            phone: sim.user.phone_number ?? undefined,
          },
          sim: { cid: d!.cid!, snPin: d!.pin1 ?? '—', snCode: d!.cid!, snPuk: d!.puk1, status: 'COMPLETED' },
          qrBuffer: buffer,
        });
      },
    ];
    for (const task of tasks) {
      try {
        await task();
      } catch {
        await this.record(
          sim,
          'mobiline_callback_post_processing_failed',
          'eSIM выдана, но постобработка не завершена',
          'warning',
        );
      }
    }
    return { success: true };
  }
}
