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

    await this.send(message);
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

📄 Ответ:
${JSON.stringify(params.response)}
`;

    await this.send(message);
  }

  public async notifyNewOrder(orderId: number, customerName?: string) {
    const message =
      `📦 Новый заказ принят!\n` + `ID заказа: ${orderId}\n` + (customerName ? `Клиент: ${customerName}` : '');

    await this.send(message);
  }

  private async send(message: string) {
    try {
      await this.bot.sendMessage('7646452005', message, {
        parse_mode: 'Markdown',
      });

      this.logger.log(`Сообщение отправлено администратору.`);
    } catch (error) {
      this.logger.error(`Ошибка отправки сообщения: ${error.message}`);
    }
  }
}
