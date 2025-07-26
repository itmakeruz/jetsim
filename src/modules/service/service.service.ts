import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceDto, GetServicetDto, UpdateServiceDto } from './dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetServicetDto) {
    const services = await paginate('service', {
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
      data: services,
    };
  }

  async findOne(id: number) {
    const service = await this.prisma.service.findUnique({
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

    if (!service) {
      throw new NotFoundException('Служба с указанным идентификатором не найдена!');
    }

    return {
      status: HttpStatus.OK,
      data: service,
    };
  }

  async create(data: CreateServiceDto) {
    await this.prisma.service.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        description_ru: data.description_ru,
        description_en: data.description_en,
      },
    });

    return {
      status: HttpStatus.CREATED,
    };
  }

  async update(id: number, data: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Служба с указанным идентификатором не найдена!');
    }

    await this.prisma.service.update({
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
    const service = await this.prisma.service.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Служба с указанным идентификатором не найдена!');
    }

    await this.prisma.service.update({
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
