import { MAIL_USER } from '@config';
import { PartnerIds } from '@enums';
import { BillionConnectService, JoyTel } from '@http';
import { WinstonLoggerService } from '@logger';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { OrderStatus } from '@prisma/client';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';

@Injectable()
export class CreateSimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joyTel: JoyTel,
    private readonly logger: WinstonLoggerService,
    private readonly billionConnect: BillionConnectService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async processJoyTel(order_id: number, user_id: number, item: any) {
    const claimed = await this.claimSim(item.id);
    if (!claimed) {
      return true;
    }

    let providerResponse: any;
    // const sim = await this.prisma.sims.create({
    //   data: {
    //     user_id: user_id,
    //     order_id: order_id,
    //     partner_id: PartnerIds.JOYTEL,
    //     tariff_id: item.tariff_id,
    //     status: OrderStatus.CREATED,
    //   },
    //   select: {
    //     id: true,
    //     order_id: true,
    //     user: {
    //       select: {
    //         email: true,
    //         name: true,
    //       },
    //     },
    //   },
    // });

    try {
      const response = await this.joyTel.submitEsimOrder(
        item.id,
        'Jetsim User',
        'string',
        MAIL_USER,
        item.tariff.sku_id,
        1,
      );
      this.logger.log('JT INIT ORDER RESPONSE: ', response);
      console.log(response);

      if (response?.code !== 0) {
        providerResponse = response;
        throw new Error(response?.message ?? response?.mesg ?? 'JoyTel order request failed');
      }

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

      // await this.telegramBotService.notifyOrderSuccess({
      //   partnerId: 1,
      //   orderId: sim.order_id,
      //   esimId: sim.id,
      //   date: new Date().toISOString(),
      //   client: {
      //     name: sim.user.name,
      //     email: sim.user.email,
      //   },
      //   tradeCode: response?.data?.orderCode,
      //   providerOrderId: response?.data?.orderTid,
      //   response,
      // });
      return true;
    } catch (e) {
      const errorResponse = this.normalizeProviderError(e, providerResponse);
      await this.failSim(item.id, errorResponse, PartnerIds.JOYTEL);
      return false;
    }
  }

  async processBillion(order_id: number, user_id: number, item) {
    const claimed = await this.claimSim(item.id);
    if (!claimed) {
      return true;
    }

    let providerResponse: any;
    // const sim = await this.prisma.sims.create({
    //   data: {
    //     user_id: user_id,
    //     order_id: order_id,
    //     partner_id: PartnerIds.BILLION_CONNECT,
    //     tariff_id: item.tariff_id,
    //     status: OrderStatus.CREATED,
    //   },
    //   select: {
    //     id: true,
    //     order_id: true,
    //     tariff: {
    //       select: {
    //         id: true,
    //         sku_id: true,
    //         validity_period: true,
    //       },
    //     },
    //     user: {
    //       select: {
    //         name: true,
    //         email: true,
    //       },
    //     },
    //   },
    // });

    try {
      const fiksirovanniy_sku_ids = ['1756107340691234', '1768370171837992', '1768370171830991'];

      const isFiksirovanniySkuId = fiksirovanniy_sku_ids?.includes(item?.tariff?.sku_id);
      const response = await this.billionConnect.createEsimOrder({
        channelOrderId: item.id.toString(),
        email: item.user.email || undefined,
        subOrderList: [
          {
            channelSubOrderId: item.id.toString(),
            deviceSkuId: item.tariff.sku_id,
            planSkuCopies: isFiksirovanniySkuId ? '1' : item?.tariff?.validity_period?.toString(),
            number: '1',
          },
        ],
      });
      console.log(response);

      this.logger.log('BC INIT ORDER RESPONSE: ', response);

      if (response?.tradeCode !== '1000' || response?.tradeData?.successFlag !== 'true') {
        providerResponse = response;
        throw new Error(response?.tradeMsg ?? 'BillionConnect order request failed');
      }

      await this.prisma.sims.update({
        where: { id: item.id },
        data: {
          status: OrderStatus.NOTIFY_COUPON,
          partner_order_id: response.tradeData.orderId,
          response,
          updated_at: new Date(),
        },
      });

      // await this.telegramBotService.notifyOrderSuccess({
      //   partnerId: 2,
      //   orderId: item.order_id,
      //   esimId: item.id,
      //   date: new Date().toISOString(),
      //   client: {
      //     name: item.user.name,
      //     email: item.user.email,
      //   },
      //   tradeCode: response?.tradeCode ?? response?.data?.orderCode,
      //   providerOrderId: response?.tradeData?.orderId ?? response?.data?.orderTid,
      //   response,
      // });
      return true;
    } catch (e) {
      const errorResponse = this.normalizeProviderError(e, providerResponse);
      console.log(errorResponse);
      await this.failSim(item.id, errorResponse, PartnerIds.BILLION_CONNECT);
      return false;
    }
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

  private async failSim(simId: number, response: any, partnerId: number) {
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
