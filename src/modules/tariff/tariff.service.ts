import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTariffDto, GetTarifftDto, UpdateTariffDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';
import { Status } from '@prisma/client';

@Injectable()
export class TariffService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetTarifftDto, lang: string) {
    const tariffs = await paginate('tariff', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        [`name_${lang}`]: true,
        [`title_${lang}`]: true,
        [`description_${lang}`]: true,
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      data: tariffs?.data?.map((tariff) => ({
        id: tariff?.id,
        name: tariff?.[`name_${lang}`],
        title: tariff?.[`title_${lang}`],
        description: tariff?.[`description_${lang}`],
        status: tariff?.status,
        is_popular: tariff?.is_popular,
        is_4g: tariff?.is_4g,
        is_5g: tariff?.is_5g,
        created_at: tariff?.created_at,
      })),
      ...tariffs,
    };
  }

  async findAllAdmin(query: GetTarifftDto) {
    const tariffs = await paginate('tariff', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        description_ru: true,
        description_en: true,
        created_at: true,
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
        name_ru: true,
        name_en: true,
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
        name_ru: data.name_ru,
        name_en: data.name_en,
        description_ru: data.description_ru,
        description_en: data.description_en,
        status: data.status as Status,
        partner_id: data.partner_id,
        region_id: data.region_id,
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
        name_ru: service?.name_ru ?? data?.name_ru,
        name_en: service?.name_en ?? data?.name_en,
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
