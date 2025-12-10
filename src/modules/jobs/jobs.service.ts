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

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkSimStatusOnPartnerSide() {
    this.logger.log('Sim Status on partner side CRON is working!');
    const sims = await this.prisma.sims.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        sim_status: {
          not: null,
        },
      },
      select: {
        id: true,
        coupon: true,
        partner_id: true,
        channel_order_id: true,
        iccid: true,
      },
    });
    console.log(sims);

    if (!sims || sims.length === 0) {
      this.logger.log('Sims not found for update status');
      return;
    }

    for (let sim of sims) {
      if (sim.partner_id === PartnerIds.JOYTEL) {
        const response = await this.joyTelService.getStatus({ coupon: sim?.coupon });
        console.log('Joytel check status response: ', response);
      }
      if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
        const response = await this.billionConnectService.getStatus({ iccid: sim?.iccid });
        console.log('BC CHECK status cron response: ', response);
      }
    }
    this.logger.info('Finish update partner status in partner side');
  }

  // @Cron(CronExpression.EVERY_12_HOURS)
  // async updateBalance() {
  //   this.logger.log('Joy Tel Orders Checker CRON is working!');
  // }
}
