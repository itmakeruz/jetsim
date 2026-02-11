import { BadRequestException, Injectable } from '@nestjs/common';
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
import { MyLogger } from 'src/logging/logger.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
    private readonly TbankService: TBank,
    private readonly orderService: OrderService,
    private readonly socketGateway: GatewayGateway,
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

  async getPaymentInfos(userId: number, lang: string) {
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

    if (!basket) {
      throw new BadRequestException(basket_empty[lang]);
    }

    const totalAmount = basket.items.reduce((sum, item) => {
      const itemPrice = item.price;
      return sum + itemPrice * item.quantity;
    }, 0);

    // Transaction, Order, SIMlar – bitta basket o‘qishda
    const transaction = await this.prisma.transaction.create({
      data: {
        amount: totalAmount.toString(),
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
        items: basket?.items?.map((item) => ({
          Name: item?.tariff?.name_ru,
          Price: item?.tariff?.price_sell,
          Quantity: item?.quantity,
          Amount: item?.tariff?.price_sell * item?.quantity,
          Tax: TaxValues.NONE,
        })),
        user: {
          id: basket?.user.id,
          email: basket.user.email,
        },
        order: {
          totalAmount: totalAmount,
        },
        transaction: {
          transactionId: transaction.id,
        },
      },
    };
  }

  async preparePayment(userId: number, lang: string) {
    const { data } = await this.getPaymentInfos(userId, lang);

    const paymentPayload = {
      Amount: data?.order?.totalAmount,
      OrderId: data?.transaction.transactionId,
      Description: `Оплата eSIM-карты на ${data?.order?.totalAmount / 100}`,
      // DATA: {
      //   Email: data?.user?.email,
      // },
      Receipt: {
        Email: data?.user?.email ?? 'ravshanovtohir11@gmail.com',
        // "Phone": "+79031234567",
        Taxation: 'usn_income_outcome', //aniqlab to'girlash kere bo'ladi
        Items: data?.items,
      },
    };

    await this.prisma.transaction.update({
      where: { id: data.transaction.transactionId },
      data: { request: JSON.stringify(paymentPayload) },
    });

    // Log request/response as structured objects so they are readable in log dashboard
    // this.logger.log({
    //   message: 'REQUEST TO GENERATE PAYMENT URL',
    //   payload: paymentPayload,
    // });

    const response = await this.TbankService.initPayment(paymentPayload);

    // this.logger.log({
    //   message: 'RESPONSE FROM GENERATE PAYMENT URL',
    //   payload: response,
    // });

    if (response?.Success !== true) {
      await this.prisma.transaction.update({
        where: { id: data.transaction.transactionId },
        data: {
          status: TransactionStatus.ERROR,
          request: JSON.stringify(paymentPayload),
          updated_at: new Date(),
        },
      });
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
    this.logger.log('TBANK WEBHOOK DATA: ', data);
    console.log(data);

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

      // 4. Order yaratish (faqat winner keladi bu yerga)
      if (existTransaction.user?.id) {
        try {
          await this.prisma.order.create({
            data: {
              transaction_id: existTransaction.id,
              user_id: existTransaction.user.id,
              status: OrderStatus.CREATED,
            },
          });
        } catch (error) {
          // Agar boshqa request yaratib ulgurgan bo‘lsa (paranoid safety)
          if (error.code !== 'P2002') {
            this.logger.error('Order create error:', error);
            throw error;
          }
        }

        // 5. Socket faqat real success bo‘lganda
        await this.socketGateway.sendPaymentStatus(existTransaction.user.id, {
          status: TransactionStatus.SUCCESS,
        });

        // 6. Biznes logika: mavjud SIMlarni partnerlarga jo‘natish (yoki basketdan yaratish)
        await this.orderService.create(existTransaction.user.id, existTransaction.id);
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
}
