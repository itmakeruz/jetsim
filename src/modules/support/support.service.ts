import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSupportOperatorsDto, GetUserInfosDto, UpdateSupportOperatorsDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: any) {
    const operators = await paginate('supportOperators', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name: true,
        login: true,
        status: true,
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      ...operators,
      data: operators?.data?.map((operator) => ({
        id: operator?.id,
        name: operator?.name,
        login: operator?.login,
        status: operator?.status,
        created_at: operator?.created_at,
      })),
    };
  }

  async findOne(id: number) {
    const operator = await this.prisma.supportOperators.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        login: true,
        status: true,
        created_at: true,
      },
    });

    if (!operator) {
      throw new NotFoundException('Оператор с указанным идентификатором не найден!');
    }

    return {
      status: HttpStatus.OK,
      data: {
        id: operator?.id,
        name: operator?.name,
        login: operator?.login,
        status: operator?.status,
        created_at: operator?.created_at,
      },
    };
  }

  async create(data: CreateSupportOperatorsDto) {
    await this.prisma.supportOperators.create({
      data: {
        name: data?.operator_name,
        login: data?.operator_login,
        password: await bcrypt.hash(data?.operator_password, 10),
      },
    });

    return {
      status: HttpStatus.OK,
    };
  }

  async update(id: number, data: UpdateSupportOperatorsDto) {
    const existOperator = await this.prisma.supportOperators.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        login: true,
        password: true,
      },
    });

    if (!existOperator) {
      throw new NotFoundException('Оператор с указанным идентификатором не найден!');
    }

    await this.prisma.supportOperators.update({
      where: {
        id: existOperator.id,
      },
      data: {
        name: data?.operator_name ? data?.operator_name : existOperator.name,
        login: data?.operator_login ? data?.operator_login : existOperator.login,
        password: data?.operator_password ? await bcrypt.hash(data?.operator_password, 10) : existOperator.password,
        updated_at: new Date(),
      },
    });

    return {
      status: HttpStatus.OK,
    };
  }

  async remove(id: number) {
    const existOperator = await this.prisma.supportOperators.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
      },
    });

    if (!existOperator) {
      throw new NotFoundException('Оператор с указанным идентификатором не найден!');
    }

    await this.prisma.supportOperators.delete({
      where: {
        id: existOperator.id,
      },
    });

    return {
      status: HttpStatus.NO_CONTENT,
    };
  }

  async ordersByUserId(data: GetUserInfosDto) {
    const orders = await this.prisma.order.findMany({
      where: {
        user_id: data.user_id,
      },
      select: {
        id: true,
        status: true,
        sims: {
          select: {
            id: true,
            tariff: {
              select: {
                id: true,
                sku_id: true,
              },
            },
            cid: true,
            qrcode: true,
            status: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      data: orders,
    };
  }
}
