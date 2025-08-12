import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto, UpdateOrderDto, GetOrderDto, AddToBascet } from './dto';
import { PrismaService } from '@prisma';
import { OrderStatus, Status } from '@prisma/client';
import { BillionConnect, JoyTel } from '@http';
import { PartnerIds } from '@enums';
import { paginate } from '@helpers';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joyTel: JoyTel,
    private readonly billionConnect: BillionConnect,
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

  async create(user_id: number = 1) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: user_id,
      },
      select: {
        id: true,
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

    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
        is_verified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Пользователь не найден или не верифицирован!');
    }

    const orders = [];
    const responses = [];

    for (const item of basket.items) {
      if (item.package.status !== Status.ACTIVE) {
        throw new ConflictException(`Пакет ${item.package.id} неактивен!`);
      }

      const partner_id = item.package.tariff.partner_id;

      const newOrder = await this.prisma.order.create({
        data: {
          user_id,
          package_id: item.package_id,
          status: OrderStatus.CREATED,
          partner_id,
        },
        select: { id: true },
      });

      let response: any;

      if (partner_id === PartnerIds.JOYTEL) {
        response = await this.joyTel.submitEsimOrder(
          user.name,
          user.email,
          user.email,
          item.package.sku_id,
          1,
          newOrder.id,
        );
      } else if (partner_id === PartnerIds.BILLION_CONNECT) {
        const body = {
          plan_id: newOrder.id,
          email: user.email,
          sku_id: item.package.sku_id,
          day: 1,
        };
        response = await this.billionConnect.orderSimcard(body);
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

  async addToBascet(data: AddToBascet, sessionId: string, userId: number, lang: string) {
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

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
