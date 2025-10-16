import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { UpdateOrderDto, GetOrderDto, AddToBasket } from './dto';
import { PrismaService } from '@prisma';
import { OrderStatus, Status } from '@prisma/client';
import { BillionConnectService, JoyTel } from '@http';
import { PartnerIds } from '@enums';
import { paginate, QrService, sendMailHelper, generateFastEsimInstallmentString, newOrderMessage } from '@helpers';
import { v4 as uuidv4 } from 'uuid';
import { BillionConnectCallbackResponse, JoyTelCallbackResponse, NotifyResponseJoyTel } from '@interfaces';
import { GatewayGateway } from '../gateway';
import { WinstonLoggerService } from '@logger';
import {
  basket_empty,
  user_not_found,
  order_not_found,
  order_create_success,
  basket_add_success,
  basket_remove_success,
  tariff_not_found,
  FilePath,
} from '@constants';
import { MAIL_USER } from '@config';

@Injectable()
export class OrderService {
  // private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private joyTel: JoyTel,
    private readonly billionConnect: BillionConnectService,
    private readonly socketGateway: GatewayGateway,
    private readonly qrService: QrService,
    private readonly logger: WinstonLoggerService,
  ) {}
  async findAll(query: GetOrderDto) {
    const { data, ...meta } = await paginate('order', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        sims: {
          select: {
            id: true,
            qrcode: true,
            tariff: {
              select: {
                id: true,
                quantity_sms: true,
                quantity_minute: true,
                quantity_internet: true,
                price_sell: true,
              },
            },
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    return {
      success: true,
      message: 'success',
      data: data,
      ...meta,
    };
  }

  async staticOrders(query: GetOrderDto, userId: number, lang: string) {
    const orders = await paginate('order', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        created_at: true,
        sims: {
          select: {
            id: true,
            tariff: {
              select: {
                id: true,
                quantity_sms: true,
                quantity_minute: true,
                quantity_internet: true,
                price_sell: true,
              },
            },
            qrcode: true,
            created_at: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'success',
      data: orders?.data?.map((order: any) => {
        return {
          id: order?.id,
          tariff: order.package?.tariff?.[`name_${lang}`],
          // sms_count: order?.package?.sms_count,
          // minutes_count: order?.package?.minutes_count,
          // mb_count: order?.package?.mb_count,
          created_at: order?.created_at,
        };
      }),
      ...orders,
    };
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        created_at: true,
        sims: {
          select: {
            id: true,
            qrcode: true,
            created_at: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException();
    }

    return {
      success: true,
      message: 'ok',
      data: {
        id: order?.id,
        created_at: order?.created_at,
      },
    };
  }

  async create(user_id: number) {
    this.logger.log('Creating order for user:', user_id);

    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: user_id,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            is_verified: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            tariff_id: true,
            tariff: {
              select: {
                id: true,
                status: true,
                sku_id: true,
                partner_id: true,
              },
            },
          },
        },
      },
    });

    if (!basket || basket?.items?.length === 0) {
      throw new BadRequestException(basket_empty['ru']);
    }

    if (!basket.user.is_verified) {
      throw new BadRequestException(user_not_found['ru']);
    }

    const newOrder = await this.prisma.order.create({
      data: {
        user_id,
        status: OrderStatus.CREATED,
      },
      select: {
        id: true,
      },
    });

    setImmediate(async () => {
      const orders = [];
      const responses = [];
      for (const item of basket.items) {
        try {
          if (item.tariff.status !== Status.ACTIVE) {
            throw new ConflictException(`Пакет ${item.tariff.id} неактивен!`);
          }

          let response: any;
          const partner_id = item.tariff.partner_id;

          if (partner_id === PartnerIds.JOYTEL) {
            const newSim = await this.prisma.sims.create({
              data: {
                user_id: basket.user.id,
                order_id: newOrder.id,
                status: OrderStatus.CREATED,
                partner_id: PartnerIds.JOYTEL,
                tariff_id: item.tariff_id,
              },
            });
            response = await this.joyTel.submitEsimOrder(
              newSim.id,
              'Jetsim User',
              'string',
              MAIL_USER,
              item.tariff.sku_id,
              1,
            );

            // response = {
            //   tradeCode: '1000',
            //   tradeMsg: '成功',
            //   tradeData: {
            //     channelOrderId: '137',
            //     orderId: '2756382091550128',
            //     subOrderList: [
            //       {
            //         subOrderId: '1756382091554129',
            //         channelSubOrderId: '93',
            //       },
            //     ],
            //   },
            // };
            let status = true;
            if (response.code !== 0 && response) {
              status = false;
            }

            await this.prisma.sims.update({
              where: {
                id: newSim.id,
              },
              data: {
                order_tid: response?.orderTid,
                order_code: response?.orderCode,
                status: status ? OrderStatus.REDEEM_COUPON : OrderStatus.FAILED,
              },
            });
          } else if (partner_id === PartnerIds.BILLION_CONNECT) {
            const newSim = await this.prisma.sims.create({
              data: {
                user_id: basket.user.id,
                order_id: newOrder.id,
                status: OrderStatus.CREATED,
                partner_id: PartnerIds.BILLION_CONNECT,
                tariff_id: item.tariff_id,
              },
            });

            const body = {
              channelOrderId: newSim.id.toString(),
              email: basket.user.email || undefined,
              subOrderList: [
                {
                  channelSubOrderId: item.id.toString(),
                  deviceSkuId: item.tariff.sku_id,
                  planSkuCopies: '1',
                  number: '1',
                },
              ],
            };

            response = await this.billionConnect.createEsimOrder(body);
            // response = {
            //   tradeCode: '1000',
            //   tradeMsg: '成功',
            //   tradeData: {
            //     channelOrderId: '137',
            //     orderId: '2756382091550128',
            //     subOrderList: [
            //       {
            //         subOrderId: '1756382091554129',
            //         channelSubOrderId: '93',
            //       },
            //     ],
            //   },
            // };

            let status = true;
            if (response.tradeCode !== '1000') {
              status = false;
            }

            await this.prisma.sims.update({
              where: {
                id: newSim.id,
              },
              data: {
                status: status ? OrderStatus.NOTIFY_COUPON : OrderStatus.FAILED,
              },
            });
          }
          orders.push(newOrder);
          responses.push({ order: newOrder, partnerResponse: response });
        } catch (error) {
          this.logger.info('Order item failed', error);
          await this.socketGateway.sendErrorOrderMessage(user_id, newOrder.id);
        }
      }

      await this.prisma.basketItem.deleteMany({
        where: { basket_id: basket.id },
      });
    });

    return {
      success: true,
      message: 'Заказ оформлен (частичные ошибки возможны).',
      data: {
        order_id: newOrder.id,
      },
    };
  }

  async getBasket(userId: number, lang: string) {
    const basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
      select: {
        items: {
          select: {
            id: true,
            price: true,
            quantity: true,
            region: {
              select: {
                id: true,
                [`name_${lang}`]: true,
                image: true,
              },
            },
            tariff: {
              select: {
                id: true,
                type: true,
                quantity_sms: true,
                quantity_minute: true,
                quantity_internet: true,
                validity_period: true,
                is_4g: true,
                is_5g: true,
                price_sell: true,
                tariff_type: true,
              },
            },
          },
        },
      },
    });

    if (!basket) {
      return {
        success: true,
        message: '',
        data: { items: [], total: 0 },
      };
    }

    const total = basket.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    return {
      success: true,
      message: '',
      data: {
        items: basket.items.map((item) => ({
          id: item.id,
          name: item.tariff ? item.tariff.type : item.region?.[`name_${lang}`],
          price: item.tariff?.price_sell ?? item.price,
          quantity: item.quantity,
          total_amount: Number(item.price) * item.quantity,
          region: {
            id: item.region?.id,
            name: item.region?.[`name_${lang}`],
            image: `${FilePath.REGION_ICON}/${item.region?.image}`,
          },
          tariff: item.tariff
            ? {
                id: item.tariff.id,
                type: {
                  id: item?.tariff?.tariff_type?.id,
                  name: item?.tariff?.tariff_type?.[`name_${lang}`],
                },
                quantity_sms: item.tariff.quantity_sms,
                quantity_minute: item.tariff.quantity_minute,
                quantity_internet: item.tariff.quantity_internet,
                validity_period: item.tariff.validity_period,
                is_4g: item.tariff.is_4g,
                is_5g: item.tariff.is_5g,
                price_sell: item.tariff.price_sell,
              }
            : null,
        })),
        total,
      },
    };
  }

  async addItemsToBasket(data: AddToBasket[], userId: number, lang: string) {
    let basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    if (!basket) {
      basket = await this.prisma.basket.create({
        data: { user_id: userId, status: 'ACTIVE' },
      });
    }

    for (const item of data) {
      const region = await this.prisma.region.findUnique({
        where: { id: item.region_id },
      });

      if (!region) {
        throw new NotFoundException('Region not found');
      }

      const tariff = await this.prisma.tariff.findUnique({
        where: { id: item.tariff_id },
      });

      if (!tariff) {
        throw new NotFoundException('Tariff not found');
      }

      const existingItem = await this.prisma.basketItem.findFirst({
        where: {
          basket_id: basket.id,
          region_id: item.region_id,
          tariff_id: item.tariff_id,
        },
      });

      if (existingItem) {
        await this.prisma.basketItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + item.quantity },
        });
      } else {
        await this.prisma.basketItem.create({
          data: {
            basket_id: basket.id,
            region_id: item.region_id,
            tariff_id: item.tariff_id,
            quantity: item.quantity,
            price: tariff?.price_sell?.toString() ?? '0',
          },
        });
      }
    }

    return this.getBasket(userId, lang);
  }

  async addToBasket(data: AddToBasket, userId: number, lang: string) {
    let basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    if (!basket) {
      basket = await this.prisma.basket.create({
        data: { user_id: userId, status: 'ACTIVE' },
      });
    }

    const region = await this.prisma.region.findUnique({
      where: { id: data.region_id },
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const tariff = await this.prisma.tariff.findUnique({
      where: { id: data.tariff_id },
    });

    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }

    const existingItem = await this.prisma.basketItem.findFirst({
      where: {
        basket_id: basket.id,
        region_id: data.region_id,
        tariff_id: data.tariff_id,
      },
    });

    if (existingItem) {
      await this.prisma.basketItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + data.quantity },
      });
    } else {
      await this.prisma.basketItem.create({
        data: {
          basket_id: basket.id,
          region_id: data.region_id,
          tariff_id: data.tariff_id,
          quantity: data.quantity,
          price: tariff?.price_sell?.toString() ?? '0',
        },
      });
    }

    return this.getBasket(userId, lang);
  }

  async removeFromBasket(itemId: number, userId: number) {
    const basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    if (!basket) throw new NotFoundException('Basket not found');

    await this.prisma.basketItem.delete({
      where: { id: itemId },
    });

    return { success: true, message: '', data: null };
  }

  async decreaseQuantity(itemId: number, userId: number) {
    const basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    if (!basket) throw new NotFoundException('Basket not found');

    const item = await this.prisma.basketItem.findFirst({
      where: { id: itemId, basket_id: basket.id },
    });

    if (!item) throw new NotFoundException('Item not found');

    if (item.quantity > 1) {
      await this.prisma.basketItem.update({
        where: { id: itemId },
        data: { quantity: item.quantity - 1 },
      });
    } else {
      await this.prisma.basketItem.delete({ where: { id: itemId } });
    }

    return { success: true, message: '', data: null };
  }

  async redeemCoupon(data: JoyTelCallbackResponse) {
    this.logger.log('JoyTel Redeem Coupon:', data);
    const sim = await this.prisma.sims.findFirst({
      where: {
        order_tid: data.orderTid,
        order_code: data.orderCode,
      },
    });

    if (!sim) {
      throw new BadRequestException('Order not found');
    }

    const snList = data.itemList?.map((el) => el.snList?.[0]).filter((sn) => sn !== undefined) || [];

    if (snList.length === 0) {
      throw new BadRequestException('No valid SN data found');
    }

    const firstSn = snList[0];
    const productCode = data.itemList[0]?.productCode;

    await this.prisma.sims.update({
      where: {
        id: sim.id,
      },
      data: {
        sn_code: firstSn.snCode,
        sn_pin: firstSn.snPin,
        product_code: productCode,
        status: OrderStatus.NOTIFY_COUPON,
      },
    });

    await this.joyTel.redeemCouponForQrCode(firstSn.snPin);

    return {
      code: '000',
      mesg: 'Success',
    };
  }

  async notifyCoupon(data: NotifyResponseJoyTel) {
    this.logger.log('JoyTel Notify Coupon:', data);
    const sim = await this.prisma.sims.findFirst({
      where: {
        sn_pin: data.data.coupon,
      },
    });

    if (!sim) {
      throw new BadRequestException('order not found!');
    }

    const updatedOrder = await this.prisma.sims.update({
      where: {
        id: sim.id,
      },
      data: {
        coupon: data.data.coupon,
        qrcodeType: data.data.qrcodeType,
        qrcode: data.data.qrcode,
        cid: data.data.cid,
        sale_plan_name: data.data.salePlanName,
        sale_plan_days: data.data.salePlanDays.toString(),
        pin_1: data.data.pin1,
        pin_2: data.data.pin2,
        puk_1: data.data.puk1,
        puk_2: data.data.puk2,
        status: OrderStatus.COMPLETED,
      },
      include: {
        user: true,
        tariff: true,
      },
    });

    await this.socketGateway.sendOrderMessage(sim.user_id, updatedOrder.id, updatedOrder.qrcode);

    const qrBuffer = await this.qrService.generateQrWithLogo(updatedOrder.qrcode);
    const fasturl = generateFastEsimInstallmentString(updatedOrder.qrcode);
    const html = newOrderMessage(
      'Клиент',
      updatedOrder.id,
      fasturl,
      updatedOrder.tariff.name_ru,
      updatedOrder.tariff.quantity_internet,
      updatedOrder.tariff.quantity_minute,
      updatedOrder.tariff.quantity_sms,
    );
    await sendMailHelper(updatedOrder.user.email, 'Ваш eSIM заказ готов!', '', html, qrBuffer);

    return {
      code: '000',
      mesg: 'Success',
    };
  }

  async bcCallback(data: BillionConnectCallbackResponse) {
    this.logger.log('BillionConnect callback data:', data);
    console.log(data);

    const sim = await this.prisma.sims.findUnique({
      where: {
        id: Number(data?.tradeData?.channelOrderId),
      },
    });

    if (!sim) {
      this.logger.error(
        `Error while execute BC callback can not find sim with that id: ${data?.tradeData?.channelOrderId}`,
      );
      throw new NotFoundException(order_not_found['en']);
    }

    const updatedSim = await this.prisma.sims.update({
      where: {
        id: sim.id,
      },
      data: {
        uid: data?.tradeData?.subOrderList?.[0]?.uid,
        iccid: data?.tradeData?.subOrderList?.[0]?.iccid,
        sub_order_id: data?.tradeData?.subOrderList?.[0]?.subOrderId,
        pin_1: data?.tradeData?.subOrderList?.[0]?.pin,
        puk_1: data?.tradeData?.subOrderList?.[0]?.puk,
        product_expire_date: data?.tradeData?.subOrderList?.[0]?.validTime,
        channel_sub_order_id: data?.tradeData?.subOrderList?.[0]?.channelSubOrderId,
        msisdn: data?.tradeData?.subOrderList?.[0]?.msisdn,
        apn: data?.tradeData?.subOrderList?.[0]?.apn,
        status: OrderStatus.COMPLETED,
        channel_order_id: data?.tradeData?.channelOrderId,
        order_code: data?.tradeData?.orderId,
        qrcode: data?.tradeData?.subOrderList?.[0]?.qrCodeContent,
        qrcodeType: 0,
      },
      include: {
        user: true,
        tariff: true,
      },
    });
    await this.socketGateway.sendOrderMessage(sim.user_id, updatedSim.id, updatedSim.qrcode);

    const qrBuffer = await this.qrService.generateQrWithLogo(updatedSim.qrcode);
    const fasturl = generateFastEsimInstallmentString(updatedSim.qrcode);
    const html = newOrderMessage(
      'Клиент',
      updatedSim.id,
      fasturl,
      updatedSim.tariff.name_ru,
      updatedSim.tariff.quantity_internet,
      updatedSim.tariff.quantity_minute,
      updatedSim.tariff.quantity_sms,
    );
    await sendMailHelper(updatedSim.user.email, 'Ваш eSIM заказ готов!', '', html, qrBuffer);

    return {
      code: '000',
      mesg: 'Success',
    };
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
