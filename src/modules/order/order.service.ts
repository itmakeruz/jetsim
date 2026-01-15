import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateOrderDto, GetOrderDto, AddToBasket } from './dto';
import { PrismaService } from '@prisma';
import { OrderStatus, Status } from '@prisma/client';
import { BillionConnectService, JoyTel } from '@http';
import { PartnerIds } from '@enums';
import {
  paginate,
  QrService,
  sendMailHelper,
  generateFastEsimInstallmentString,
  newOrderMessage,
  saveQrCode,
  getRemainingDays,
} from '@helpers';
import { v4 as uuidv4 } from 'uuid';
import { BillionConnectCallbackResponse, JoyTelCallbackResponse, NotifyResponseJoyTel } from '@interfaces';
import { GatewayGateway } from '../gateway';
import { WinstonLoggerService } from '@logger';
import { basket_empty, user_not_found, order_not_found, FilePath, partner_not_found } from '@constants';
import { MAIL_USER } from '@config';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';
import { CreateSimService } from './create-sim/create-sim.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private joyTel: JoyTel,
    private readonly billionConnect: BillionConnectService,
    private readonly socketGateway: GatewayGateway,
    private readonly qrService: QrService,
    private readonly logger: WinstonLoggerService,
    private readonly telegramBotService: TelegramBotService,
    private readonly createSimsService: CreateSimService,
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
            iccid: true,
            pin_1: true,
            puk_1: true,
            qrcode: true,
            tariff: {
              select: {
                id: true,
                name_en: true,
                name_ru: true,
                quantity_sms: true,
                quantity_minute: true,
                quantity_internet: true,
                validity_period: true,
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
      data: data?.map((order: any) => {
        return {
          id: order?.id,
          created_at: order?.created_at,
          sims: order?.sims?.map((sim: any) => {
            return {
              id: sim?.id,
              iccid: sim?.iccid,
              pin_1: sim?.pin_1,
              puk_1: sim?.puk_1,
              status: sim?.status,
              tariff: {
                id: sim?.tariff?.id,
                name_ru: sim?.tariff?.name_ru,
                name_en: sim?.tariff?.name_en,
                quantity_sms: sim?.tariff?.quantity_sms,
                quantity_minute: sim?.tariff?.quantity_minute,
                quantity_internet: sim?.tariff?.quantity_internet,
                validity_period: sim?.tariff?.validity_period,
                price_sell: sim?.tariff?.price_sell / 100,
              },
              created_at: sim?.created_at,
              day_left: getRemainingDays(sim?.created_at, sim?.tariff?.validity_period),
            };
          }),
        };
      }),
      ...meta,
    };
  }

  async staticOrders(query: GetOrderDto, userId: number, lang: string) {
    const sims = await paginate('sims', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        order_id: true,
        created_at: true,
        main_region: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            image: true,
            created_at: true,
          },
        },
        tariff: {
          select: {
            id: true,
            is_4g: true,
            is_5g: true,
            name_ru: true,
            name_en: true,
            quantity_internet: true,
            validity_period: true,
            regions: {
              select: {
                id: true,
                [`name_${lang}`]: true,
                image: true,
                status: true,
                created_at: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'success',
      ...sims,
      data: sims?.data?.map((sim: any) => {
        return {
          id: sim?.id,
          order_id: sim?.order_id,
          region: {
            id: sim?.main_region?.id,
            name: sim?.main_region?.[`name_${lang}`],
            image: sim?.main_region?.image ? `${FilePath.REGION_ICON}/${sim?.main_region?.image}` : null,
            created_at: sim?.main_region?.created_at,
          },
          tariff: {
            id: sim?.tariff?.id,
            name: sim?.tariff?.[`name_${lang}`],
            usage: 300,
            day_left: getRemainingDays(sim?.created_at, sim?.tariff?.validity_period),
            is_4g: sim?.tariff?.is_4g,
            is_5g: sim?.tariff?.is_5g,
            quantity_internet: sim?.tariff?.quantity_internet,
            validity_period: sim?.tariff?.validity_period,
            qrcode: `${FilePath.QR_CODE_IMAGES}/qr_content_${sim?.id}.png`,
            regions: sim?.tariff?.regions?.map((region: any) => ({
              id: region?.id,
              name: region?.[`name_${lang}`],
              image: `${FilePath.REGION_ICON}/${region?.image}`,
              status: region?.status,
              created_at: region?.created_at,
            })),
          },
          created_at: sim?.created_at,
        };
      }),
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

  // async create(user_id: number, transactionId: number) {
  //   this.logger.log('Creating order for user:', user_id);

  //   const basket = await this.prisma.basket.findFirst({
  //     where: {
  //       user_id: user_id,
  //     },
  //     select: {
  //       id: true,
  //       user: {
  //         select: {
  //           id: true,
  //           is_verified: true,
  //           email: true,
  //         },
  //       },
  //       items: {
  //         select: {
  //           id: true,
  //           tariff_id: true,
  //           region_id: true,
  //           tariff: {
  //             select: {
  //               id: true,
  //               status: true,
  //               sku_id: true,
  //               partner_id: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!basket || basket?.items?.length === 0) {
  //     throw new BadRequestException(basket_empty['ru']);
  //   }

  //   if (!basket.user.is_verified) {
  //     throw new BadRequestException(user_not_found['ru']);
  //   }

  //   const newOrder = await this.prisma.order.create({
  //     data: {
  //       user_id,
  //       status: OrderStatus.CREATED,
  //       transaction_id: transactionId,
  //     },
  //     select: {
  //       id: true,
  //       user: true,
  //     },
  //   });

  //   const orders = [];
  //   const responses = [];
  //   for (const item of basket.items) {
  //     try {
  //       if (item.tariff.status !== Status.ACTIVE) {
  //         throw new ConflictException(`Пакет ${item.tariff.id} неактивен!`);
  //       }

  //       let response: any;
  //       const partner_id = item.tariff.partner_id;

  //       if (partner_id === PartnerIds.JOYTEL) {
  //         const newSim = await this.prisma.sims.create({
  //           data: {
  //             user_id: basket.user.id,
  //             order_id: newOrder.id,
  //             status: OrderStatus.CREATED,
  //             partner_id: PartnerIds.JOYTEL,
  //             tariff_id: item.tariff_id,
  //             main_region_id: item?.region_id,
  //           },
  //         });
  //         response = await this.joyTel.submitEsimOrder(
  //           newSim.id,
  //           'Jetsim User',
  //           'string',
  //           MAIL_USER,
  //           item.tariff.sku_id,
  //           1,
  //         );
  //         console.log(response);

  //         // response = {
  //         //   tradeCode: '1000',
  //         //   tradeMsg: '成功',
  //         //   tradeData: {
  //         //     channelOrderId: '137',
  //         //     orderId: '2756382091550128',
  //         //     subOrderList: [
  //         //       {
  //         //         subOrderId: '1756382091554129',
  //         //         channelSubOrderId: '93',
  //         //       },
  //         //     ],
  //         //   },
  //         // };
  //         let status = true;
  //         if (response.code !== 0 && response) {
  //           status = false;
  //         }

  //         await this.prisma.sims.update({
  //           where: {
  //             id: newSim.id,
  //           },
  //           data: {
  //             order_tid: response?.orderTid,
  //             order_code: response?.orderCode,
  //             status: status ? OrderStatus.REDEEM_COUPON : OrderStatus.FAILED,
  //             response: Object.assign(newSim?.response, response),
  //           },
  //           select: {
  //             id: true,
  //           },
  //         });
  //         if (status) {
  //           await this.telegramBotService.notifyOrderSuccess({
  //             partnerId: 1,
  //             orderId: newOrder.id,
  //             esimId: newSim.id,
  //             date: new Date().toISOString(),
  //             client: {
  //               name: newOrder.user.name,
  //               email: newOrder.user.email,
  //             },
  //             tradeCode: response.code,
  //             providerOrderId: response.orderTid,
  //             response,
  //           });
  //         } else {
  //           await this.telegramBotService.notifyOrderError({
  //             partnerId: 1,
  //             orderId: newOrder.id,
  //             esimId: newSim.id,
  //             date: new Date().toISOString(),
  //             client: {
  //               name: newOrder.user.name,
  //               email: newOrder.user.email,
  //             },
  //             errorCode: response.code,
  //             providerOrderId: response.orderTid,
  //             response,
  //           });
  //         }
  //       } else if (partner_id === PartnerIds.BILLION_CONNECT) {
  //         const newSim = await this.prisma.sims.create({
  //           data: {
  //             user_id: basket.user.id,
  //             order_id: newOrder.id,
  //             status: OrderStatus.CREATED,
  //             partner_id: PartnerIds.BILLION_CONNECT,
  //             tariff_id: item.tariff_id,
  //             main_region_id: item?.region_id,
  //           },
  //         });

  //         const body = {
  //           channelOrderId: newSim.id.toString(),
  //           email: basket.user.email || undefined,
  //           subOrderList: [
  //             {
  //               channelSubOrderId: item.id.toString(),
  //               deviceSkuId: item.tariff.sku_id,
  //               planSkuCopies: '1',
  //               number: '1',
  //             },
  //           ],
  //         };

  //         response = await this.billionConnect.createEsimOrder(body);
  //         // response = {
  //         //   tradeCode: '1000',
  //         //   tradeMsg: '成功',
  //         //   tradeData: {
  //         //     channelOrderId: '137',
  //         //     orderId: '2756382091550128',
  //         //     subOrderList: [
  //         //       {
  //         //         subOrderId: '1756382091554129',
  //         //         channelSubOrderId: '93',
  //         //       },
  //         //     ],
  //         //   },
  //         // };
  //         console.log(response);

  //         let status = true;
  //         if (response.tradeCode !== '1000') {
  //           status = false;
  //         }

  //         await this.prisma.sims.update({
  //           where: {
  //             id: newSim.id,
  //           },
  //           data: {
  //             status: status ? OrderStatus.NOTIFY_COUPON : OrderStatus.FAILED,
  //             response: Object.assign(newSim?.response, response),
  //             partner_order_id: response?.tradeData?.orderId,
  //           },
  //         });

  //         if (status) {
  //           await this.telegramBotService.notifyOrderSuccess({
  //             partnerId: 2,
  //             orderId: newOrder.id,
  //             esimId: newSim.id,
  //             date: new Date().toISOString(),
  //             client: {
  //               name: newOrder.user.name,
  //               email: newOrder.user.email,
  //             },
  //             tradeCode: response?.tradeCode,
  //             providerOrderId: response?.tradeData?.orderId,
  //             response,
  //           });
  //         } else {
  //           await this.telegramBotService.notifyOrderError({
  //             partnerId: 2,
  //             orderId: newOrder.id,
  //             esimId: newSim.id,
  //             date: new Date().toISOString(),
  //             client: {
  //               name: newOrder.user.name,
  //               email: newOrder.user.email,
  //             },
  //             errorCode: response?.tradeCode,
  //             providerOrderId: response?.tradeData?.orderId,
  //             response,
  //           });
  //         }
  //       }
  //       orders.push(newOrder);
  //       responses.push({ order: newOrder, partnerResponse: response });
  //     } catch (error) {
  //       this.logger.info('Order item failed', error);
  //       await this.socketGateway.sendErrorOrderMessage(user_id, newOrder.id);
  //     }
  //   }

  //   await this.prisma.basketItem.deleteMany({
  //     where: { basket_id: basket.id },
  //   });

  //   return {
  //     success: true,
  //     message: 'Заказ оформлен (частичные ошибки возможны).',
  //     data: {
  //       order_id: newOrder.id,
  //     },
  //   };
  // }

  async create(user_id: number, transactionId: number) {
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
            region_id: true,
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

    this.logger.log(`Bascet items for user ${user_id}: `, basket);

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
        transaction_id: transactionId ?? 2010,
      },
      select: {
        id: true,
        user: true,
      },
    });

    for (const item of basket.items) {
      try {
        if (item.tariff.status !== Status.ACTIVE) {
          throw new ConflictException(`Пакет ${item.tariff.id} неактивен!`);
        }

        const partner_id = item.tariff.partner_id;

        if (partner_id === PartnerIds.JOYTEL) {
          await this.createSimsService.processJoyTel(newOrder.id, newOrder.user.id, item);
        }

        if (partner_id === PartnerIds.BILLION_CONNECT) {
          await this.createSimsService.processBillion(newOrder.id, newOrder.user.id, item);
        }
      } catch (error) {
        this.logger.info('Order item failed', error);
        await this.socketGateway.sendErrorOrderMessage(user_id, newOrder.id);
      }
    }

    await this.prisma.basketItem.deleteMany({
      where: {
        basket_id: basket.id,
      },
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
            tariff: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                type: true,
                quantity_sms: true,
                quantity_minute: true,
                quantity_internet: true,
                validity_period: true,
                is_4g: true,
                is_5g: true,
                price_sell: true,
                regions: {
                  select: {
                    id: true,
                    [`name_${lang}`]: true,
                    image: true,
                    status: true,
                    created_at: true,
                  },
                },
                region_group: {
                  select: {
                    id: true,
                    name_ru: true,
                    name_en: true,
                    image: true,
                    status: true,
                    created_at: true,
                  },
                },
              },
            },
          },
          orderBy: {
            created_at: 'desc',
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

    const total = basket.items.reduce((sum, item) => sum + (item.price / 100) * item.quantity, 0);

    return {
      success: true,
      message: '',
      data: {
        items: basket.items.map((item) => ({
          id: item?.tariff?.id,
          name: item?.tariff?.[`name_${lang}`],
          price_sell: item.tariff?.price_sell ? item.tariff?.price_sell / 100 : item?.price,
          total_amount: Number(item.price / 100) * item.quantity,
          quantity_sms: item.tariff.quantity_sms,
          quantity_minute: item.tariff.quantity_minute,
          quantity_internet: item.tariff.quantity_internet * 1024,
          validity_period: item.tariff.validity_period,
          is_4g: item.tariff.is_4g,
          is_5g: item.tariff.is_5g,
          image: `${FilePath.REGION_GROUP_ICON}/${item.tariff?.region_group?.image}`,
          quantity: item.quantity,
          regions: item?.tariff?.regions?.map((region) => ({
            id: region?.id,
            name: region?.[`name_${lang}`],
            image: `${FilePath.REGION_ICON}/${region?.image}`,
          })),
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
      const tariff = await this.prisma.tariff.findUnique({
        where: { id: item.tariff_id },
      });

      if (!tariff) {
        throw new NotFoundException('Tariff not found');
      }

      const existingItem = await this.prisma.basketItem.findFirst({
        where: {
          basket_id: basket.id,
          tariff_id: item.tariff_id, // ❗ region olib tashlandi
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
            tariff_id: item.tariff_id,
            quantity: item.quantity,
            price: tariff?.price_sell,
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

    // const region = await this.prisma.region.findUnique({
    //   where: { id: data.region_id },
    // });

    // if (!region) {
    //   throw new NotFoundException('Region not found');
    // }

    const tariff = await this.prisma.tariff.findUnique({
      where: { id: data.tariff_id },
    });

    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }

    const existingItem = await this.prisma.basketItem.findFirst({
      where: {
        basket_id: basket.id,
        // region_id: data.region_id,
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
          // region_id: data.region_id,
          tariff_id: data.tariff_id,
          quantity: data.quantity,
          price: tariff?.price_sell,
        },
      });
    }

    return this.getBasket(userId, lang);
  }

  async removeFromBasket(data: { tariff_id: number }, userId: number, lang: string) {
    const basket = await this.prisma.basket.findFirst({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    if (!basket) throw new NotFoundException('Basket not found');

    const item = await this.prisma.basketItem.findFirst({
      where: {
        basket_id: basket.id,
        tariff_id: data.tariff_id,
        // region_id: data.region_id,
      },
    });

    if (!item) throw new NotFoundException('Item not found');

    await this.prisma.basketItem.delete({ where: { id: item.id } });

    return this.getBasket(userId, lang);
  }

  async decreaseQuantity(data: { tariff_id: number }, userId: number, lang: string) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: userId,
        status: Status.ACTIVE,
      },
    });

    if (!basket) {
      throw new NotFoundException('Basket not found!');
    }

    const item = await this.prisma.basketItem.findFirst({
      where: {
        basket_id: basket.id,
        tariff_id: data.tariff_id,
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.quantity > 1) {
      await this.prisma.basketItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity - 1 },
      });
    } else {
      await this.prisma.basketItem.delete({ where: { id: item.id } });
    }

    return this.getBasket(userId, lang);
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

    const items = data.itemList ? Object.values(data.itemList) : [];

    if (items.length === 0) {
      throw new BadRequestException('Item list is empty');
    }

    const snList = items.flatMap((item) => (item.snList ? Object.values(item.snList) : [])).filter(Boolean);

    if (snList.length === 0) {
      throw new BadRequestException('No valid SN data found');
    }

    const firstSn = snList[0];
    const productCode = items[0].productCode;

    await this.prisma.sims.update({
      where: { id: sim.id },
      data: {
        sn_code: firstSn.snCode,
        sn_pin: firstSn.snPin,
        pin_1: firstSn.snPin,
        puk_1: firstSn.snPuk || null,
        uid: firstSn.snCode,
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
        qrcode_type: data.data.qrcodeType,
        qrcode: data.data.qrcode,
        cid: data.data.cid,
        iccid: data.data.cid,
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
      updatedOrder?.pin_1,
      updatedOrder?.pin_2,
      updatedOrder?.puk_1,
      updatedOrder?.puk_2,
    );
    // await sendMailHelper(updatedOrder.user.email, 'Ваш eSIM заказ готов!', '', html, qrBuffer);
    saveQrCode(updatedOrder.id, qrBuffer);

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
        qrcode_type: 0,
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
      updatedSim?.pin_1,
      updatedSim?.pin_2,
      updatedSim?.puk_1,
      updatedSim?.puk_2,
    );
    // await sendMailHelper(updatedSim.user.email, 'Ваш eSIM заказ готов!', '', html, qrBuffer);
    saveQrCode(updatedSim.id, qrBuffer);

    return {
      tradeCode: '1000',
      tradeMsg: 'Success',
    };
  }

  async getUsage(simId: number) {
    console.log(simId);

    const sim = await this.prisma.sims.findUnique({
      where: {
        id: simId,
      },
      select: {
        id: true,
        channel_order_id: true,
        channel_sub_order_id: true,
        iccid: true,
        coupon: true,
        order_code: true,
        tariff: {
          select: {
            id: true,
            sku_id: true,
          },
        },
        partner: {
          select: {
            id: true,
            identified_number: true,
          },
        },
      },
    });

    if (!sim) {
      throw new NotFoundException(partner_not_found['ru']);
    }
    let response;

    if (sim?.partner?.identified_number === PartnerIds.JOYTEL) {
      response = await this.joyTel.getUsage({ coupon: sim?.coupon });
      console.log(response);
    }
    if (sim?.partner?.identified_number === PartnerIds.BILLION_CONNECT) {
      response = await this.billionConnect.getUsage({
        orderId: sim?.order_code,
        // channelOrderId: sim?.channel_order_id,
        iccid: sim?.iccid,
        // language: 2,
      });
    }
    return {
      success: true,
      message: true,
      data: response,
    };
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
