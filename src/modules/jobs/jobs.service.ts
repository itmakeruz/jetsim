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

  // @Cron(CronExpression.EVERY_5_MINUTES)
  // async checkSimStatusOnPartnerSide() {
  //   this.logger.log('Sim Status on partner side CRON is working!');
  //   const sims = await this.prisma.sims.findMany({
  //     where: {
  //       status: OrderStatus.COMPLETED,
  //       sim_status: {
  //         notIn: [SimStatus.ACTIVATED, SimStatus.EXPIRED],
  //       },
  //       coupon: {
  //         not: null,
  //       },
  //       iccid: {
  //         not: null,
  //       },
  //     },
  //     select: {
  //       id: true,
  //       coupon: true,
  //       partner_id: true,
  //       channel_order_id: true,
  //       iccid: true,
  //     },
  //   });
  // }

  // @Cron(CronExpression.EVERY_12_HOURS)
  // async updateBalance() {
  //   this.logger.log('Joy Tel Orders Checker CRON is working!');
  // }
}
