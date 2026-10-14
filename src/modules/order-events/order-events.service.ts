import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { WinstonLoggerService } from '@logger';

export type OrderEventSeverity = 'info' | 'warning' | 'error';

/**
 * Полная история заказа от создания до выдачи: заказ создан, оплата
 * запрошена, пришёл вебхук от Т-Банка, заявка ушла партнёру, пришёл
 * колбэк, запрошен QR — и так далее. order_id обязателен всегда (это ось
 * таймлайна), sim_id — только у событий, относящихся к конкретной eSIM.
 *
 * Запись никогда не бросает исключение: аудит — побочный эффект, а не часть
 * основного потока заказа/оплаты/выдачи, и не должен его ронять при сбое БД.
 */
@Injectable()
export class OrderEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async record(params: {
    orderId: number;
    simId?: number | null;
    partnerId?: number | null;
    event: string;
    severity?: OrderEventSeverity;
    message?: string | null;
    meta?: unknown;
  }) {
    try {
      await this.prisma.orderEvent.create({
        data: {
          order_id: params.orderId,
          sim_id: params.simId ?? null,
          partner_id: params.partnerId ?? null,
          event: params.event,
          severity: params.severity ?? 'info',
          message: params.message ?? null,
          meta: (params.meta ?? undefined) as any,
        },
      });
    } catch (error) {
      this.logger.error(`Не удалось записать OrderEvent "${params.event}" для заказа ${params.orderId}`, error);
    }
  }
}
