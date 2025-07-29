import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '@prisma';
import { identity } from 'rxjs';
import { OrderStatus, Status } from '@prisma/client';
import { BillionConnect, JoyTel } from '@http';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joyTel: JoyTel,
    private readonly billionConnect: BillionConnect,
  ) {}
  findAll() {
    return `This action returns all order`;
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  async create(data: CreateOrderDto, user_id: number) {
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

    // if (partner_id === 1) {
    const response = this.joyTel.submitEsimOrder(
      'mendirman osha',
      '9989991221213',
      user.email,
      pck.sku_id,
      1,
      newOrder.id,
    );

    return response;
    // }
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
