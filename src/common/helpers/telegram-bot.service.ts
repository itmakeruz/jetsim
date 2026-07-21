import { TELEGRAM_BOT_TOKEN } from '@config';
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBotAPI from 'node-telegram-bot-api';

export enum PartnerIds {
  JOYTEL = 1,
  BILLION_CONNECT = 2,
}

@Injectable()
export class TelegramBotService {
  private readonly bot: TelegramBotAPI;
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly notificationChatId = '-5179566420';

  constructor() {
    this.bot = new TelegramBotAPI(TELEGRAM_BOT_TOKEN, { polling: false });

    this.bot.on('message', (msg) => {
      console.log(msg);

      this.logger.log(`Получено сообщение от ${msg.chat.id}: ${msg.text}`);
    });

    this.logger.log('Телеграм бот инициализирован.');
  }

  private getPartnerName(partnerId: PartnerIds): string {
    switch (partnerId) {
      case PartnerIds.JOYTEL:
        return 'Joytel';
      case PartnerIds.BILLION_CONNECT:
        return 'BillionConnect';
      default:
        return 'Неизвестный партнер';
    }
  }

  public async notifyOrderSuccess(params: {
    partnerId: PartnerIds;
    orderId: number;
    esimId: number;
    date: string;
    client: { name: string; email: string };
    tradeCode: string;
    providerOrderId: number;
    response: any;
  }) {
    const partnerName = this.getPartnerName(params.partnerId);

    const formattedResponse = '```json\n' + JSON.stringify(params.response, null, 2) + '\n```';

    const message = `
✅ ${partnerName} - Заказ успешно оформлен!

📋 Информация о заказе:
• ID заказа: ${params.orderId}
• ID ESIM: ${params.esimId}
• Дата: ${params.date}

👤 Клиент:
• Имя: ${params.client.name}
• Электронная почта: ${params.client.email}

🔄 Ответ от ${partnerName}:
• Trade Code: ${params.tradeCode ?? '—'}
• Order ID: ${params.providerOrderId ?? '—'}

📄 Ответ:
${formattedResponse}
`;

    await this.send(message, 'Markdown');
  }

  public async notifyOrderError(params: {
    partnerId: PartnerIds;
    orderId: number;
    esimId: number;
    date: string;
    client: { name: string; email: string };
    errorCode: string;
    providerOrderId?: number;
    response: any;
  }) {
    const partnerName = this.getPartnerName(params.partnerId);
    const formattedResponse = '```json\n' + JSON.stringify(params.response, null, 2) + '\n```';

    const message = `
⛔ Ошибка активации — ${partnerName}

📋 Данные заказа:
• ID заказа: ${params.orderId}
• ID ESIM: ${params.esimId}
• Дата: ${params.date}

👤 Клиент:
• Имя: ${params.client.name}
• Электронная почта: ${params.client.email}

⚠️ Ошибка:
• Error Code: ${params.errorCode}
• Order ID: ${params.providerOrderId ?? '—'}
• Error Message: ${params.response?.tradeMsg ?? params.response?.message ?? '—'}

📄 Ответ:
${formattedResponse}
`;

    await this.send(message);
  }

  /**
   * QR kod kelganda jo‘natiladi. Format: rasm (QR) yuqorida, matn pastda (rasmdagi kabi).
   */
  public async notifySimActivated(params: {
    orderId: number;
    esimId: number;
    date: string;
    client: { name: string; email: string; phone?: string };
    sim: { cid: string; snPin: string; snCode: string; status: string };
    qrBuffer: Buffer;
  }) {
    const formattedDate = this.formatDate(params.date);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const code = (s: string) => `<code>${esc(s)}</code>`;

    const caption = `
🆕 <b>Новая SIM-карта активирована</b>

📋 <b>Информация о заказе</b>
• ID заказа: ${code(String(params.orderId))}
• Дата: ${esc(formattedDate)}

👤 <b>Клиент</b>
• Имя: ${esc(params.client.name)}
• Телефон: ${params.client.phone ? code(params.client.phone) : '—'}
• Email: ${params.client.email ? code(params.client.email) : '—'}

📱 <b>SIM-карта</b>
• CID: ${code(params.sim.cid)}
• SN Pin: ${code(params.sim.snPin)}
• SN Code: ${code(params.sim.snCode)}
• Статус: ${code(params.sim.status)}

✅ QR-код для активации прикреплен
`;

    await this.sendPhoto(params.qrBuffer, caption);
  }

  public async notifyNewOrder(orderId: number, customerName?: string) {
    const message =
      `📦 Новый заказ принят!\n` + `ID заказа: ${orderId}\n` + (customerName ? `Клиент: ${customerName}` : '');

    await this.send(message);
  }

  private formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private async send(message: string, parseMode?: 'Markdown' | 'HTML') {
    try {
      await this.bot.sendMessage(this.notificationChatId, message, parseMode ? { parse_mode: parseMode } : {});

      this.logger.log(`Сообщение отправлено администратору.`);
    } catch (error) {
      this.logger.error(`Ошибка отправки сообщения: ${error.message}`);
    }
  }

  private async sendPhoto(photo: Buffer, caption: string) {
    try {
      await this.bot.sendPhoto(
        this.notificationChatId,
        photo,
        {
          caption: caption.trim(),
          parse_mode: 'HTML',
        },
        { filename: 'qr-code.png', contentType: 'image/png' },
      );

      this.logger.log(`QR-код отправлен администратору.`);
    } catch (error) {
      this.logger.error(`Ошибка отправки фото: ${error.message}`);
    }
  }
}
