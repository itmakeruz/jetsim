import { TELEGRAM_BOT_TOKEN } from '@config';
import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBotAPI from 'node-telegram-bot-api';

@Injectable()
export class TelegramBotService {
  private readonly bot: TelegramBotAPI;
  private readonly logger = new Logger(TelegramBotService.name);

  constructor() {
    this.bot = new TelegramBotAPI(TELEGRAM_BOT_TOKEN, {
      polling: true,
    });

    this.bot.on('message', (msg) => {
      this.logger.log(`Получено сообщение от ${msg.chat.id}: ${msg.text}`);
    });

    this.logger.log('Телеграм бот инициализирован.');
  }

  /**
   * Метод для уведомления о новом заказе
   * @param orderId ID заказа
   * @param customerName Имя клиента (необязательно)
   */
  public async notifyNewOrder(orderId: number, customerName?: string) {
    const message =
      `📦 Новый заказ принят!\n` + `ID заказа: ${orderId}\n` + (customerName ? `Клиент: ${customerName}` : '');

    try {
      await this.bot.sendMessage(7646452005, message);
      this.logger.log(`Уведомление отправлено для заказа ${orderId}`);
    } catch (error) {
      this.logger.error(`Не удалось отправить уведомление: ${error.message}`);
    }
  }
}
