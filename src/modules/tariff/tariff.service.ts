import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTariffDto, GetTarifftDto, UpdateTariffDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';

@Injectable()
export class TariffService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetTarifftDto) {
    const tariffs = await paginate('tariff', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        title: true,
        description_uz: true,
        description_ru: true,
        description_en: true,
      },
    });

    return {
      status: HttpStatus.OK,
      data: tariffs,
    };
  }

  async findOne(id: number) {
    const tariffs = await this.prisma.tariff.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
      select: {
        id: true,
        title: true,
        description_uz: true,
        description_ru: true,
        description_en: true,
        created_at: true,
      },
    });

    if (!tariffs) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    return {
      status: HttpStatus.OK,
      data: tariffs,
    };
  }

  async create(data: CreateTariffDto) {
    await this.prisma.tariff.create({
      data: {
        title: data.title,
        description_uz: data.description_uz,
        description_ru: data.description_ru,
        description_en: data.description_en,
      },
    });

    return {
      status: HttpStatus.CREATED,
    };
  }

  async update(id: number, data: UpdateTariffDto) {
    const service = await this.prisma.tariff.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    await this.prisma.tariff.update({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
      data: {
        title: service?.title ?? data?.title,
        description_uz: service?.description_uz ?? data?.description_uz,
        description_ru: service?.description_ru ?? data?.description_ru,
        description_en: service?.description_en ?? data?.description_en,
        updated_at: new Date(),
      },
    });

    return {
      status: HttpStatus.OK,
    };
  }

  async remove(id: number) {
    const service = await this.prisma.tariff.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    await this.prisma.tariff.update({
      where: {
        id: service.id,
      },
      data: {
        deleted_at: new Date(),
      },
    });
    return {
      status: HttpStatus.NO_CONTENT,
    };
  }
}
