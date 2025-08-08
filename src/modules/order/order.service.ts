import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto, UpdateOrderDto, GetOrderDto } from './dto';
import { PrismaService } from '@prisma';
import { OrderStatus, Status } from '@prisma/client';
import { BillionConnect, JoyTel } from '@http';
import { PartnerIds } from '@enums';
import { paginate } from '@helpers';

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

  async create(data: CreateOrderDto, user_id: number = 1) {
    const pck = await this.prisma.package.findUnique({
      where: {
        id: data.package_id,
      },
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
    });

    const partner_id = pck.tariff.partner_id;

    if (!pck) {
      throw new NotFoundException('Тариф не найден!');
    }

    if (pck.status !== Status.ACTIVE) {
      throw new ConflictException('Этот пакет неактивен!');
    }

    const newOrder = await this.prisma.order.create({
      data: {
        user_id: user_id,
        package_id: data.package_id,
        status: OrderStatus.CREATED,
        partner_id: partner_id,
      },
      select: {
        id: true,
      },
    });

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

    let response: any;

    if (partner_id === PartnerIds.JOYTEL) {
      response = await this.joyTel.submitEsimOrder(user.name, user.email, user.email, pck.sku_id, 1, newOrder.id);
    }

    if (partner_id === PartnerIds.BILLION_CONNECT) {
      const body = {
        plan_id: newOrder.id,
        email: user.email,
        sku_id: pck.sku_id,
        day: 1,
      };
      response = await this.billionConnect.orderSimcard(body);
    }
    return {
      status: HttpStatus.CREATED,
      message: 'order created successfully!',
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
