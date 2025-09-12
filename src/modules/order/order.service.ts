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

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private joyTel: JoyTel,
    private readonly billionConnect: BillionConnectService,
    private readonly socketGateway: GatewayGateway,
    private readonly qrService: QrService,
  ) {}
  async findAll(query: GetOrderDto) {
    const { data, ...meta } = await paginate('order', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        created_at: true,
        package: {
          select: {
            id: true,
            sms_count: true,
            minutes_count: true,
            mb_count: true,
            tariff: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
              },
            },
          },
        },
      },
    });

    return {
      status: HttpStatus.OK,
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
        package: {
          select: {
            id: true,
            sms_count: true,
            minutes_count: true,
            mb_count: true,
            tariff: {
              select: {
                id: true,
                [`name_${lang}`]: true,
                [`description_${lang}`]: true,
              },
            },
          },
        },
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'success',
      data: orders?.data?.map((order: any) => {
        return {
          id: order?.id,
          tariff: order.package?.tariff?.[`name_${lang}`],
          sms_count: order?.package?.sms_count,
          minutes_count: order?.package?.minutes_count,
          mb_count: order?.package?.mb_count,
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
        package: {
          select: {
            id: true,
            sms_count: true,
            minutes_count: true,
            mb_count: true,
            tariff: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                description_ru: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException();
    }

    return {
      status: HttpStatus.OK,
      message: 'ok',
      data: {
        id: order?.id,
        tariff: order?.package.tariff.name_ru,
        sms_count: order?.package.sms_count,
        minutes_count: order?.package.minutes_count,
        mb_count: order?.package.mb_count,
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
            package_id: true,
            package: {
              select: {
                id: true,
                status: true,
                sku_id: true,
                tariff: {
                  select: {
                    id: true,
                    partner_id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!basket || basket?.items?.length === 0) {
      throw new BadRequestException('Корзина пуста!');
    }

    // const user = await this.prisma.user.findUnique({
    //   where: {
    //     id: user_id,
    //     is_verified: true,
    //   },
    //   select: {
    //     id: true,
    //     name: true,
    //     email: true,
    //   },
    // });

    if (!basket.user.is_verified) {
      throw new BadRequestException('Пользователь не найден или не верифицирован!');
    }

    const orders = [];
    const responses = [];

    const newOrder = await this.prisma.order.create({
      data: {
        user_id,
        status: OrderStatus.CREATED,
      },
      select: {
        id: true,
      },
    });

    for (const item of basket.items) {
      if (item.package.status !== Status.ACTIVE) {
        throw new ConflictException(`Пакет ${item.package.id} неактивен!`);
      }

      let response: any;
      const partner_id = item.package.tariff.partner_id;

      if (partner_id === PartnerIds.JOYTEL) {
        const newSim = await this.prisma.sims.create({
          data: {
            user_id: basket.user.id,
            order_id: newOrder.id,
            status: OrderStatus.CREATED,
            partner_id: PartnerIds.JOYTEL,
            package_id: item.package_id,
          },
        });
        response = await this.joyTel.submitEsimOrder(
          newSim.id,
          'Jetsim User',
          'string',
          'jetsim@gmail.com',
          item.package.sku_id,
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
        if (response.tradeCode !== '1000') {
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
            package_id: item.package_id,
          },
        });

        const body = {
          channelOrderId: newSim.id.toString(),
          email: basket.user.email || undefined,
          subOrderList: [
            {
              channelSubOrderId: item.id.toString(),
              deviceSkuId: item.package.sku_id,
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
        if (response.code !== 0) {
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
    }

    await this.prisma.basketItem.deleteMany({
      where: { basket_id: basket.id },
    });

    return {
      status: HttpStatus.CREATED,
      message: 'Заказ оформлен успешно!',
      data: responses,
    };
  }

  async addToBascet(data: AddToBasket, sessionId: string, userId: number, lang: string) {
    let basket;
    if (userId) {
      basket = await this.prisma.basket.findFirst({
        where: {
          user_id: userId,
          status: 'ACTIVE',
        },
      });
      if (!basket) {
        basket = await this.prisma.basket.create({
          data: {
            user_id: userId,
          },
        });
      }
    } else {
      if (!sessionId) {
        sessionId = uuidv4();
      }
      basket = await this.prisma.basket.findFirst({
        where: {
          session_id: sessionId,
          status: 'ACTIVE',
        },
      });
      if (!basket) {
        basket = await this.prisma.basket.create({
          data: {
            session_id: sessionId,
          },
        });
      }
    }

    const pkg = await this.prisma.package.findUnique({
      where: {
        id: data.package_id,
      },
    });
    if (!pkg) {
      throw new NotFoundException('Пакет не найден!');
    }

    const existingItem = await this.prisma.basketItem.findFirst({
      where: {
        basket_id: basket.id,
        package_id: data.package_id,
      },
    });

    if (existingItem) {
      await this.prisma.basketItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + data.quantity,
        },
      });
    } else {
      await this.prisma.basketItem.create({
        data: {
          basket_id: basket.id,
          package_id: data.package_id,
          quantity: data.quantity,
          price: '1',
        },
      });
    }

    const fullBasket = await this.prisma.basket.findUnique({
      where: {
        id: basket.id,
      },
      select: {
        items: {
          select: {
            id: true,
            package_id: true,
            price: true,
            quantity: true,
            package: {
              select: {
                tariff: {
                  select: {
                    [`name_${lang}`]: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const total = fullBasket.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    return {
      basket_id: basket.id,
      session_id: sessionId,
      items: fullBasket.items.map((item) => ({
        id: item.id,
        package_id: item.package_id,
        name: item?.package?.tariff?.[`name_${lang}`],
        price: item.price,
        quantity: item.quantity,
        total: Number(item.price) * item.quantity,
      })),
      total,
    };
  }

  async removeFromBasket(itemId: number, sessionId?: string, userId?: number) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        status: 'ACTIVE',
        ...(userId ? { user_id: userId } : { session_id: sessionId }),
      },
    });

    if (!basket) {
      throw new Error('Basket not found');
    }

    await this.prisma.basketItem.delete({
      where: {
        id: itemId,
        basket_id: basket.id,
      },
    });

    return { success: true };
  }

  async decreaseQuantity(itemId: number, sessionId?: string, userId?: number) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        status: 'ACTIVE',
        ...(userId ? { user_id: userId } : { session_id: sessionId }),
      },
    });

    if (!basket) throw new Error('Basket not found');

    const item = await this.prisma.basketItem.findFirst({
      where: { id: itemId, basket_id: basket.id },
    });

    if (!item) throw new Error('Item not found');

    if (item.quantity > 1) {
      return this.prisma.basketItem.update({
        where: { id: itemId },
        data: { quantity: item.quantity - 1 },
      });
    } else {
      return this.prisma.basketItem.delete({
        where: { id: itemId },
      });
    }
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
        package: {
          include: {
            tariff: true,
          },
        },
      },
    });

    await this.socketGateway.sendOrderMessage(sim.user_id, updatedOrder.id, updatedOrder.qrcode);

    const qrBuffer = await this.qrService.generateQrWithLogo(updatedOrder.qrcode);
    const fasturl = generateFastEsimInstallmentString(updatedOrder.qrcode);
    const html = newOrderMessage(
      'Клиент',
      updatedOrder.id,
      fasturl,
      updatedOrder.package.tariff.name_ru,
      updatedOrder.package.mb_count,
      updatedOrder.package.minutes_count,
      updatedOrder.package.sms_count,
    );
    await sendMailHelper(updatedOrder.user.email, 'Ваш eSIM заказ готов!', '', html, qrBuffer);

    return {
      code: '000',
      mesg: 'Success',
    };
  }

  async bcCallback(data: BillionConnectCallbackResponse) {
    this.logger.log('BillionConnect callback data:', data);
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: Number(data.tradeData.channelOrderId),
      },
    });

    console.log(sim);

    if (!sim) {
      throw new NotFoundException('Order not found');
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
        package: {
          include: {
            tariff: true,
          },
        },
      },
    });
    console.log(updatedSim, 'updatedOrder');

    await this.socketGateway.sendOrderMessage(sim.user_id, updatedSim.id, updatedSim.qrcode);

    const qrBuffer = await this.qrService.generateQrWithLogo(updatedSim.qrcode);
    const fasturl = generateFastEsimInstallmentString(updatedSim.qrcode);
    const html = newOrderMessage(
      'Клиент',
      updatedSim.id,
      fasturl,
      updatedSim.package.tariff.name_ru,
      updatedSim.package.mb_count,
      updatedSim.package.minutes_count,
      updatedSim.package.sms_count,
    );
    console.log('man shettgaxcha keldim');
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
