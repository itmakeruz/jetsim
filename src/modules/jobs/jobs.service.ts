import { PartnerIds } from '@enums';
import { BillionConnectService, JoyTel } from '@http';
import { WinstonLoggerService } from '@logger';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@prisma';
import { OrderStatus, TransactionStatus } from '@prisma/client';
import { OrderService } from '../order/order.service';
import { PromoCodeService } from '../promocode';

/** Через сколько брошенный заказ в статусе CREATED считается протухшим */
const STALE_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

/** Статусы, при которых деньги уже в системе — такие заказы отменять нельзя */
const PAID_TRANSACTION_STATUSES = [TransactionStatus.SUCCESS, TransactionStatus.WAITING_ORDER_CONFIRMATION];

@Injectable()
export class JobsService {
  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly prisma: PrismaService,
    private readonly joyTelService: JoyTel,
    private readonly billionConnectService: BillionConnectService,
    private readonly orderService: OrderService,
    private readonly promoCodeService: PromoCodeService,
  ) {}

  private isProcessingConfirmedPayments = false;
  private isCancellingStaleOrders = false;

  @Cron(CronExpression.EVERY_12_HOURS)
  async updateBalance() {
    this.logger.log('Joy Tel Orders Checker CRON is working!');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingConfirmedPayments() {
    if (this.isProcessingConfirmedPayments) {
      return;
    }

    this.isProcessingConfirmedPayments = true;

    try {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          status: TransactionStatus.SUCCESS,
          user_id: { not: null },
          order: {
            sims: {
              some: {
                status: OrderStatus.CREATED,
              },
            },
          },
        },
        select: {
          id: true,
          user_id: true,
        },
        orderBy: {
          created_at: 'asc',
        },
        take: 20,
      });

      for (const transaction of transactions) {
        try {
          await this.orderService.create(transaction.user_id, transaction.id);
        } catch (error) {
          this.logger.error(`Confirmed payment recovery failed for transaction ${transaction.id}`, error);
        }
      }
    } finally {
      this.isProcessingConfirmedPayments = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cancelStaleOrders() {
    if (this.isCancellingStaleOrders) {
      return;
    }

    this.isCancellingStaleOrders = true;

    try {
      const cutoff = new Date(Date.now() - STALE_ORDER_TTL_MS);

      const staleOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.CREATED,
          created_at: { lt: cutoff },
          // Заказы с пришедшими деньгами не трогаем ни при каких условиях
          transactions: { none: { status: { in: PAID_TRANSACTION_STATUSES } } },
        },
        select: {
          id: true,
          transactions: { select: { id: true } },
        },
        orderBy: { created_at: 'asc' },
        take: 20,
      });

      for (const order of staleOrders) {
        try {
          const cancelled = await this.cancelStaleOrder(order.id);

          if (!cancelled) {
            continue;
          }

          for (const transaction of order.transactions) {
            await this.promoCodeService.cancelUsageByTransaction(transaction.id);
          }

          this.logger.log(`Stale order ${order.id} cancelled after ${STALE_ORDER_TTL_MS / 3600000}h`);
        } catch (error) {
          this.logger.error(`Stale order cancellation failed for order ${order.id}`, error);
        }
      }
    } finally {
      this.isCancellingStaleOrders = false;
    }
  }

  private async cancelStaleOrder(orderId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Оплата могла прийти между выборкой и этим обновлением — перепроверяем под транзакцией
      const paid = await tx.transaction.count({
        where: {
          order_id: orderId,
          status: { in: PAID_TRANSACTION_STATUSES },
        },
      });

      if (paid > 0) {
        return false;
      }

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.CREATED },
        data: { status: OrderStatus.FAILED },
      });

      if (updated.count === 0) {
        return false;
      }

      await tx.sims.updateMany({
        where: { order_id: orderId, status: OrderStatus.CREATED },
        data: { status: OrderStatus.FAILED },
      });

      await tx.transaction.updateMany({
        where: { order_id: orderId, status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.CANCELED },
      });

      return true;
    });
  }

  @Cron('*/20 * * * *')
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
      orderBy: {
        created_at: 'desc',
      },
    });

    for (const sim of sims) {
      try {
        /**
         * ======================
         * JOYTEL
         * ======================
         */
        if (sim.partner_id === PartnerIds.JOYTEL) {
          const response = await this.joyTelService.getUsage({
            coupon: sim.coupon,
          });

          const usageList = response?.dataUsageList ?? [];

          if (!Array.isArray(usageList) || usageList.length === 0) {
            continue;
          }

          let totalBytes = 0;

          for (const item of usageList) {
            totalBytes += Number(item?.usage || 0);
          }

          const totalMb = +(totalBytes / (1024 * 1024)).toFixed(2);

          if (sim.last_usage_quantity !== totalMb.toString()) {
            await this.prisma.sims.update({
              where: { id: sim.id },
              data: {
                last_usage_quantity: totalMb.toString(),
              },
            });

            this.logger.log(`JOYTEL SIM ${sim.id} → ${totalMb} MB`);
          }
        }

        /**
         * ======================
         * BILLION CONNECT
         * ======================
         */
        if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
          const response = await this.billionConnectService.getUsage({
            iccid: sim.iccid,
            orderId: sim.partner_order_id,
          });

          if (response?.tradeCode !== '1000') {
            continue;
          }

          const subOrders = response?.tradeData?.subOrderList ?? [];

          let totalKb = 0;

          for (const sub of subOrders) {
            const usageList = sub?.usageInfoList ?? [];

            for (const usage of usageList) {
              totalKb += Number(usage?.usageAmt || 0);
            }
          }

          const totalMb = +(totalKb / 1024).toFixed(2);

          console.log(`BILLION SIM ${sim.id}: ${totalKb} KB = ${totalMb} MB`);

          await this.prisma.sims.update({
            where: { id: sim.id },
            data: {
              last_usage_quantity: totalMb.toString(),
            },
          });
        }
      } catch (error) {
        this.logger.error(`SIM usage update failed for SIM ${sim.id}`, error);
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
