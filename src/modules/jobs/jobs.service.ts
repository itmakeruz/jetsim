import { PartnerIds } from '@enums';
import { BillionConnectService, JoyTel } from '@http';
import { WinstonLoggerService } from '@logger';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@prisma';

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

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateUsage() {
    this.logger.log('Update sim usage!');

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

    for (const sim of sims) {
      try {
        /**
         * =========================
         * JOYTEL
         * =========================
         */
        if (sim.partner_id === PartnerIds.JOYTEL) {
          const response = await this.joyTelService.getUsage({
            coupon: sim.coupon,
          });

          const list = response?.dataUsageList;

          if (!Array.isArray(list) || list.length === 0) {
            continue;
          }

          const totalBytes = list.reduce((acc: number, item: { usage: string }) => {
            return acc + Number(item.usage || 0);
          }, 0);

          const totalMb = +(totalBytes / (1024 * 1024)).toFixed(2);

          console.log(`JOYTEL SIM ${sim.id} usage ${totalMb} MB`);

          if (sim.last_usage_quantity !== totalMb.toString()) {
            await this.prisma.sims.update({
              where: { id: sim.id },
              data: {
                last_usage_quantity: totalMb.toString(),
              },
            });
          }
        }

        /**
         * =========================
         * BILLION CONNECT
         * =========================
         */
        if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
          const response = await this.billionConnectService.getUsage({
            iccid: sim.iccid,
            orderId: sim.partner_order_id,
          });

          const tradeData = response?.tradeData;

          if (!tradeData || response?.tradeCode !== '1000') {
            continue;
          }

          const usageList = tradeData?.subOrderList?.[0]?.usageInfoList ?? [];

          if (!Array.isArray(usageList) || usageList.length === 0) {
            continue;
          }

          const totalUsage = usageList.reduce((acc: number, info: { useDate: string; useageAmt: string }) => {
            return acc + Number(info.useageAmt || 0);
          }, 0);

          const totalMb = +(totalUsage / 1024).toFixed(2);

          console.log(`BILLION CONNECT SIM ${sim.id} usage ${totalMb} MB`);

          if (sim.last_usage_quantity !== totalMb.toString()) {
            await this.prisma.sims.update({
              where: { id: sim.id },
              data: {
                last_usage_quantity: totalMb.toString(),
              },
            });
          }
        }
      } catch (error) {
        this.logger.error(`Usage update error for SIM ${sim.id}`, error);
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
