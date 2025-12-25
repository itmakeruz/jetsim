import { PartnerIds } from '@enums';
import { BillionConnectService, JoyTel } from '@http';
import { WinstonLoggerService } from '@logger';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@prisma';
import { OrderStatus, SimStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly prisma: PrismaService,
    private readonly joyTelService: JoyTel,
    private readonly billionConnectService: BillionConnectService,
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async updateBalance() {
    this.logger.log('Joy Tel Orders Checker CRON is working!');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateUsage() {
    this.logger.log('Update sim balance!');
    const sims = await this.prisma.sims.findMany({
      where: {
        status: 'COMPLETED',
      },
      select: {
        id: true,
        coupon: true,
        iccid: true,
        last_usage_quantity: true,
        partner_id: true,
        partner_order_id: true,
      },
    });

    for (let sim of sims) {
      if (sim.partner_id === PartnerIds.JOYTEL) {
        const response = await this.joyTelService.getUsage({
          coupon: sim.coupon,
        });

        const list = response?.data?.dataUsageList;
        console.log(response, list);

        if (!Array.isArray(list) || list.length === 0) {
          console.log('JOYTEL EMPTY USAGE', sim.id, list);
          continue;
        }

        const totalBytes = list.reduce((acc, item) => acc + Number(item.usage || 0), 0);
        const totalMb = +(totalBytes / (1024 * 1024)).toFixed(2);

        console.log(`JOYTEL USAGE: ${totalBytes} bytes = ${totalMb} MB`);

        await this.prisma.sims.update({
          where: { id: sim.id },
          data: {
            last_usage_quantity: totalMb.toString(),
          },
        });
      }

      if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
        const response = await this.billionConnectService.getUsage({
          iccid: sim.iccid,
          orderId: sim?.partner_order_id,
        });
        console.log(response);
        // responses.push(response);
        const tradeData = response?.tradeData ?? null;

        if (Array.isArray(tradeData) && response?.tradeCode === '1000') {
          const usage = response.subOrderList[0].usageInfoList?.reduce(
            (acc: number, infoList: { usedDate: string; usageAmt: string }) => {
              acc += Number(infoList.usedDate);
            },
            0,
          );

          console.log(usage);

          await this.prisma.sims.update({
            where: {
              id: sim.id,
            },
            data: {
              last_usage_quantity: usage.toString(),
            },
          });
        }
      }
    }
  }

  // @Cron(CronExpression.EVERY_10_SECONDS)
  // async checkSimStatusOnPartnerSide() {
  //   this.logger.log('Sim Status on partner side CRON is working!');
  //   const sims = await this.prisma.sims.findMany({
  //     where: {
  //       status: OrderStatus.COMPLETED,
  //       sim_status: null,
  //     },
  //     select: {
  //       id: true,
  //       coupon: true,
  //       partner_id: true,
  //       channel_order_id: true,
  //       iccid: true,
  //     },
  //   });
  //   console.log(sims);

  //   if (!sims || sims.length === 0) {
  //     this.logger.log('Sims not found for update status');
  //     return;
  //   }

  //   for (let sim of sims) {
  //     if (sim.partner_id === PartnerIds.JOYTEL) {
  //       const response = await this.joyTelService.getStatus({ coupon: sim?.coupon });
  //       console.log('Joytel check status response: ', response);
  //     }
  //     if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
  //       const response = await this.billionConnectService.getStatus({ iccid: sim?.iccid });
  //       console.log('BC CHECK status cron response: ', response);
  //     }
  //   }
  //   this.logger.info('Finish update partner status in partner side');
  // }

  // @Cron(CronExpression.EVERY_12_HOURS)
  // async updateBalance() {
  //   this.logger.log('Joy Tel Orders Checker CRON is working!');
  // }
}
