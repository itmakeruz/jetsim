import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePaymentDto, GetTransactionDto, UpdatePaymentDto } from './dto';
import { PrismaService } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { paginate } from '@helpers';
import { TBank } from '@http';
import { basket_empty, TBankInitRequest, TBankWebHookResponse } from '@constants';
import { TaxValues } from '@constants';
import { TransactionStatus } from '@prisma/client';
import { OrderService } from '../order/order.service';
import { GatewayGateway } from '../gateway';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
    private readonly TbankService: TBank,
    private readonly orderService: OrderService,
    private readonly socketGateway: GatewayGateway,
  ) {}
  async findAll(query: GetTransactionDto) {
    const transactions = await paginate('transaction', {
      page: query?.page,
      size: query?.size,
      // filter: query?.filters,
      // sort: query?.sort,
      select: {
        id: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        created_at: true,
      },
    });

    return {
      success: true,
      message: '',
      ...transactions,
      data: transactions.data,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} payment`;
  }

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

  async preparePayment(userId: number, lang: string) {
    const { data } = await this.getPaymentInfos(userId, lang);
    console.log(data.items);

    const transaction = await this.prisma.transaction.create({
      data: {
        amount: data?.order?.totalAmount.toString(),
        user_id: data?.user?.id,
      },
      select: {
        id: true,
      },
    });

    const paymentPayload = {
      Amount: data?.order?.totalAmount,
      OrderId: transaction?.id,
      Description: `Оплата eSIM-карты на ${data?.order?.totalAmount}`,
      // DATA: {
      //   Email: data?.user?.email,
      // },
      Receipt: {
        Email: data?.user?.email ?? 'ravshanovtohir11@gmail.com',
        // "Phone": "+79031234567",
        Taxation: 'osn', //aniqlab to'girlash kere bo'ladi
        Items: data?.items,
      },
    };

    await this.prisma.transaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        request: JSON.stringify(paymentPayload),
      },
    });

    const response = await this.TbankService.initPayment(paymentPayload);

    if (response?.Success !== true) {
      await this.prisma.transaction.update({
        where: {
          id: transaction.id,
        },
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
    this.logger.info('TBANK WEBHOOK DATA: ', data);
    console.log(data);

    const existTransaction = await this.prisma.transaction.findUnique({
      where: {
        id: Number(data?.OrderId),
      },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existTransaction) {
      throw new BadRequestException();
    }
    console.log('men tepamandeeeeee');

    if (existTransaction) {
      return;
    }
    console.log('otib ketvomanu man eeeeee');

    if (data.Success === false) {
      await this.prisma.transaction.update({
        where: {
          id: existTransaction.id,
        },
        data: {
          status: TransactionStatus.FAILED,
          partner_transaction_id: data.PaymentId,
          response: JSON.stringify(data),
          updated_at: new Date(),
        },
      });
    }

    const updatedTransaction = await this.prisma.transaction.update({
      where: {
        id: existTransaction.id,
      },
      data: {
        status: TransactionStatus.SUCCESS,
        partner_transaction_id: data.PaymentId,
        response: JSON.stringify(data),
      },
    });

    await this.socketGateway.sendPaymentStatus(existTransaction.user.id, { status: updatedTransaction.status });

    return this.orderService.create(existTransaction.user.id, updatedTransaction.id);
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
