import { BadGatewayException, Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import * as QRCode from 'qrcode';
import { NotIssuedException, OrderNotFoundException } from '../b2b.errors';
import { UsageService } from '../../usage/usage.service';

const INSTRUCTIONS = {
  ru: [
    'Подключитесь к Wi-Fi или мобильному интернету.',
    'Откройте на телефоне: Настройки → Сотовая связь (Мобильная сеть) → Добавить eSIM.',
    'Отсканируйте QR-код или введите код активации вручную.',
    'Включите новую линию для передачи данных и разрешите роуминг данных на ней.',
  ],
  en: [
    'Connect to Wi-Fi or mobile data.',
    'On your phone open: Settings → Cellular (Mobile network) → Add eSIM.',
    'Scan the QR code or enter the activation code manually.',
    'Turn on the new line for mobile data and allow data roaming on it.',
  ],
};

/** eSIM выданного заказа: ICCID, код активации, QR (на лету, без публичных файлов) и расход трафика. */
@Injectable()
export class B2bEsimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  /** Только свой заказ (чужой — 404) и только после выдачи (иначе 409 NOT_ISSUED). */
  private async issuedSim(resellerId: number, clientOrderId: string) {
    const order = await this.prisma.resellerOrder.findUnique({
      where: { reseller_id_client_order_id: { reseller_id: resellerId, client_order_id: clientOrderId } },
    });
    if (!order) throw new OrderNotFoundException();
    if (order.state !== 'ISSUED') throw new NotIssuedException();
    const sim = await this.prisma.sims.findUnique({ where: { reseller_order_id: order.id } });
    if (!sim || !sim.qrcode || !sim.iccid) throw new NotIssuedException();
    return { order, sim };
  }

  async getEsim(resellerId: number, clientOrderId: string) {
    const { order, sim } = await this.issuedSim(resellerId, clientOrderId);
    // LPA:1$<SM-DP+ адрес>$<matching id>
    const m = /^LPA:1\$([^$]+)\$(.*)$/.exec(sim.qrcode!);
    return {
      client_order_id: order.client_order_id,
      iccid: sim.iccid,
      activation_code: sim.qrcode,
      smdp_address: m?.[1] ?? null,
      matching_id: m?.[2] || null,
      validity_days: order.validity_days,
      instructions: INSTRUCTIONS,
    };
  }

  async getQrPng(resellerId: number, clientOrderId: string): Promise<Buffer> {
    const { sim } = await this.issuedSim(resellerId, clientOrderId);
    return QRCode.toBuffer(sim.qrcode!, { errorCorrectionLevel: 'M', type: 'png', width: 480, margin: 2 });
  }

  async getUsage(resellerId: number, clientOrderId: string) {
    const { order, sim } = await this.issuedSim(resellerId, clientOrderId);
    try {
      const result = await this.usage.forSim(sim.id);
      return result.status === 'ok'
        ? { client_order_id: order.client_order_id, status: 'ok', usage: result.data }
        : { client_order_id: order.client_order_id, status: result.status };
    } catch {
      // Детали поставщика партнёру не отдаём
      throw new BadGatewayException({ code: 'USAGE_UNAVAILABLE', message: 'Расход временно недоступен, повторите позже' });
    }
  }
}
