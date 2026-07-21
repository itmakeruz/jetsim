import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UpdatePaymentDto } from './dto';
import { PrismaService } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { TBank } from '@http';
import { basket_empty, TBankWebHookResponse } from '@constants';
import { TaxValues } from '@constants';
import { OrderStatus, Status, TransactionStatus } from '@prisma/client';
import { OrderService } from '../order/order.service';
import { GatewayGateway } from '../gateway';
import { PartnerIds } from '@enums';
import { PromoCodeService } from '../promocode';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
    private readonly TbankService: TBank,
    private readonly orderService: OrderService,
    private readonly socketGateway: GatewayGateway,
    private readonly promoCodeService: PromoCodeService,
  ) {}

  async create(userId: number, lang: string) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            is_verified: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            tariff: {
              select: {
                id: true,
                price_sell: true,
                name_ru: true,
              },
            },
          },
        },
      },
    });

    if (!basket) {
      throw new BadRequestException(basket_empty[lang]);
    }

    const totalAmount = basket.items.reduce((sum, item) => {
      const itemPrice = item.price;
      return sum + itemPrice * item.quantity;
    }, 0);

    return {
      success: true,
      message: '',
      data: {
        items: basket?.items?.map((item) => ({
          Name: item?.tariff?.name_ru,
          Price: item?.tariff?.price_sell,
          Quantity: item?.quantity,
          Amount: item?.tariff?.price_sell * item?.quantity,
          Tax: TaxValues.NONE,
        })),
        user: {
          id: basket?.user?.id,
          email: basket?.user?.email,
        },
        order: {
          totalAmount: totalAmount,
        },
      },
    };
  }

  async getPaymentInfos(userId: number, lang: string, promoCode?: string) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            is_verified: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            tariff_id: true,
            tariff: {
              select: {
                id: true,
                price_sell: true,
                name_ru: true,
                partner_id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!basket || basket.items.length === 0) {
      throw new BadRequestException(basket_empty[lang]);
    }

    const totalAmount = basket.items.reduce((sum, item) => {
      const itemPrice = item.price ?? item.tariff?.price_sell ?? 0;
      return sum + itemPrice * item.quantity;
    }, 0);
    const promo = await this.promoCodeService.validateCodeForPayment(userId, promoCode, totalAmount);
    const discountAmount = promo?.discount_amount ?? 0;
    const finalAmount = totalAmount - discountAmount;
    const receiptItems = this.buildReceiptItems(basket.items, discountAmount, finalAmount);

    // Transaction, Order, SIMlar – bitta basket o‘qishda
    const transaction = await this.prisma.transaction.create({
      data: {
        amount: finalAmount.toString(),
        user_id: basket.user.id,
      },
      select: { id: true },
    });

    const order = await this.prisma.order.create({
      data: {
        transaction_id: transaction.id,
        user_id: basket.user.id,
        status: OrderStatus.CREATED,
      },
      select: { id: true },
    });

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { order_id: order.id },
    });

    await this.promoCodeService.createPendingUsage({
      promo,
      userId: basket.user.id,
      transactionId: transaction.id,
      orderId: order.id,
    });

    for (const item of basket.items) {
      if (!item.tariff || item.tariff.status !== Status.ACTIVE) continue;
      const partnerId = item.tariff.partner_id;
      if (partnerId !== PartnerIds.JOYTEL && partnerId !== PartnerIds.BILLION_CONNECT) continue;
      const quantity = item.quantity ?? 1;
      for (let q = 0; q < quantity; q++) {
        await this.prisma.sims.create({
          data: {
            user_id: basket.user.id,
            order_id: order.id,
            partner_id: partnerId,
            tariff_id: item.tariff_id,
            status: OrderStatus.CREATED,
          },
        });
      }
    }

    return {
      data: {
        items: receiptItems,
        user: {
          id: basket?.user.id,
          email: basket.user.email,
        },
        order: {
          totalAmount: finalAmount,
          originalAmount: totalAmount,
          discountAmount,
        },
        promo: promo
          ? {
              code: promo.code,
              discount_amount: discountAmount,
              agent_credit_amount: promo.agent_credit_amount,
            }
          : null,
        transaction: {
          transactionId: transaction.id,
        },
      },
    };
  }

  async preparePayment(userId: number, lang: string, promoCode?: string) {
    const { data } = await this.getPaymentInfos(userId, lang, promoCode);
    const paymentPayload = this.buildPaymentPayload(data);

    await this.prisma.transaction.update({
      where: { id: data.transaction.transactionId },
      data: {
        request: JSON.stringify({
          ...paymentPayload,
          promo: data.promo,
          originalAmount: data.order.originalAmount,
          discountAmount: data.order.discountAmount,
        }),
      },
    });

    // Log request/response as structured objects so they are readable in log dashboard
    // this.logger.log({
    //   message: 'REQUEST TO GENERATE PAYMENT URL',
    //   payload: paymentPayload,
    // });

    let response;
    try {
      response = await this.TbankService.initPayment(paymentPayload);
    } catch (error) {
      await this.prisma.transaction.update({
        where: { id: data.transaction.transactionId },
        data: {
          status: TransactionStatus.ERROR,
          updated_at: new Date(),
        },
      });
      await this.promoCodeService.cancelUsageByTransaction(data.transaction.transactionId);
      throw error;
    }

    // this.logger.log({
    //   message: 'RESPONSE FROM GENERATE PAYMENT URL',
    //   payload: response,
    // });

    if (response?.Success !== true) {
      await this.prisma.transaction.update({
        where: { id: data.transaction.transactionId },
        data: {
          status: TransactionStatus.ERROR,
          updated_at: new Date(),
        },
      });
      await this.promoCodeService.cancelUsageByTransaction(data.transaction.transactionId);
      throw new BadRequestException(response?.Details ? response?.Details : response?.Message);
    }
    return {
      success: true,
      message: '',
      data: {
        payment_url: response?.PaymentURL,
      },
    };
  }

  async acceptTransactionStatus(data: TBankWebHookResponse) {
    this.logger.log('TBANK WEBHOOK RECEIVED', {
      orderId: data?.OrderId,
      paymentId: data?.PaymentId,
      status: data?.Status,
      success: data?.Success,
    });

    // if (!this.TbankService.verifyNotification(data)) {
    //   this.logger.error('TBANK WEBHOOK TOKEN INVALID', {
    //     orderId: data?.OrderId,
    //     paymentId: data?.PaymentId,
    //     status: data?.Status,
    //   });
    //   throw new UnauthorizedException('Invalid T-Bank notification token');
    // }

    const existTransactionId = Number(data?.OrderId);

    if (!existTransactionId) {
      return 'OK';
    }

    const existTransaction = await this.prisma.transaction.findUnique({
      where: {
        id: existTransactionId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    // const existTransaction = await this.prisma.transaction.findUnique({
    //   where: {
    //     id: Number(data?.OrderId),
    //   },
    //   select: {
    //     id: true,
    //     status: true,
    //     user: {
    //       select: {
    //         id: true,
    //       },
    //     },
    //   },
    // });

    if (!existTransaction) {
      return 'OK';
    }

    // FAILED ham CAS bo‘lishi shart
    if (data.Success === false) {
      await this.prisma.transaction.updateMany({
        where: {
          id: existTransactionId,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.FAILED,
          partner_transaction_id: data.PaymentId,
          response: JSON.stringify(data),
          updated_at: new Date(),
        },
      });
      await this.promoCodeService.cancelUsageByTransaction(existTransactionId);
      return 'OK';
    }

    if (data.Success === true && data.Status === 'CONFIRMED') {
      // 🔒 DB-level ATOMIC LOCK
      const updated = await this.prisma.transaction.updateMany({
        where: {
          id: existTransactionId,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.SUCCESS,
          partner_transaction_id: data.PaymentId,
          response: JSON.stringify(data),
          updated_at: new Date(),
        },
      });

      // Kimdir oldin ishlatib bo‘lgan → chiqamiz
      if (updated.count === 0) {
        return 'OK';
      }

      // T-Bank acknowledgement provider jarayonini kutmasligi kerak.
      // Payment allaqachon SUCCESS qilib saqlandi; downstream order/provider
      // jarayoni alohida davom etadi, webhook esa darhol HTTP 200 qaytaradi.
      if (existTransaction.user?.id) {
        void this.processConfirmedPayment(existTransaction.user.id, existTransaction.id);
      }
    }

    // if (existTransaction.status === TransactionStatus.SUCCESS) {
    //   return 'OK';
    // }

    // const existOrder = await this.prisma.order.findFirst({
    //   where: {
    //     transaction_id: existTransaction.id,
    //   },
    // });

    // if (existOrder) {
    //   return 'OK';
    // }

    // if (data.Success === true && data.Status === 'CONFIRMED') {
    //   const updatedTransaction = await this.prisma.transaction.update({
    //     where: {
    //       id: existTransaction.id,
    //     },
    //     data: {
    //       status: TransactionStatus.SUCCESS,
    //       partner_transaction_id: data.PaymentId,
    //       response: JSON.stringify(data),
    //       updated_at: new Date(),
    //     },
    //   });
    //   await this.socketGateway.sendPaymentStatus(existTransaction.user.id, { status: updatedTransaction.status });
    //   await this.orderService.create(existTransaction.user.id, updatedTransaction.id);
    // }
    return 'OK';
  }

  private async processConfirmedPayment(userId: number, transactionId: number) {
    try {
      await this.promoCodeService.confirmUsageByTransaction(transactionId);
    } catch (error) {
      this.logger.error(`Promo confirmation failed for transaction ${transactionId}`, error);
    }

    try {
      await this.socketGateway.sendPaymentStatus(userId, {
        status: TransactionStatus.SUCCESS,
      });
    } catch (error) {
      this.logger.error(`Payment socket notification failed for transaction ${transactionId}`, error);
    }

    try {
      await this.orderService.create(userId, transactionId);
    } catch (error) {
      this.logger.error(`Order processing failed for confirmed transaction ${transactionId}`, error);
    }
  }

  async acceptPaymentTest(id: number, data: any) {
    const response = await this.TbankService.initPayment(data);
    console.log(response);

    return response;
  }

  update(id: number, data: UpdatePaymentDto) {
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    return `This action removes a #${id} payment`;
  }

  private buildReceiptItems(items: any[], discountAmount: number, finalAmount: number) {
    if (discountAmount > 0) {
      return [
        {
          Name: 'Услуга доступа к интернету eSIM',
          Price: finalAmount,
          Quantity: 1,
          Amount: finalAmount,
          Tax: TaxValues.NONE,
        },
      ];
    }

    return items.map((item) => {
      const price = item.price ?? item?.tariff?.price_sell ?? 0;
      return {
        Name: `Услуга доступа к интернету ${item?.tariff?.name_ru}`,
        Price: price,
        Quantity: item?.quantity,
        Amount: price * item?.quantity,
        Tax: TaxValues.NONE,
      };
    });
  }

  private buildPaymentPayload(data: any) {
    return {
      Amount: data?.order?.totalAmount,
      OrderId: data?.transaction.transactionId,
      Description: `Оплата eSIM-карты на ${data?.order?.totalAmount / 100}`,
      Receipt: {
        Email: data?.user?.email ?? 'ravshanovtohir11@gmail.com',
        Taxation: 'usn_income_outcome',
        Items: data?.items,
      },
    };
  }
}
