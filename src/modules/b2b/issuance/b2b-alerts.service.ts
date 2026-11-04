import { Injectable, Logger } from '@nestjs/common';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';
import { B2bAlerts } from './provider-submitter';

@Injectable()
export class B2bAlertsService extends B2bAlerts {
  private readonly logger = new Logger(B2bAlertsService.name);

  constructor(private readonly telegram: TelegramBotService) {
    super();
  }

  async reconcileNeeded(info: { resellerOrderId: number; resellerName: string; reason: string }) {
    this.logger.warn(`B2B order ${info.resellerOrderId} (${info.resellerName}) needs reconciliation: ${info.reason}`);
    await this.telegram.notifyAlert(
      `B2B: заказ #${info.resellerOrderId} компании «${info.resellerName}» требует ручной сверки — ` +
        `исход заявки поставщику неизвестен, резерв удержан, повторная покупка не выполнялась. Причина: ${info.reason}`,
    );
  }
}
