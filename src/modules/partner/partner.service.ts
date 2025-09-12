import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartnerDto, UpdatePartnerDto, GetAllPartnerDto } from './dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetAllPartnerDto) {
    const partners = await paginate('partner', {
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
        status: true,
      },
    });
    return {
      status: HttpStatus.OK,
      ...partners,
    };
  }

  async findOne(id: number) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        description_ru: true,
        description_en: true,
        status: true,
      },
    });

    if (!partner) {
      throw new NotFoundException(`Партнер не найден`);
    }

    return {
      status: HttpStatus.OK,
      data: partner,
    };
  }

  async create(data: CreatePartnerDto) {
    if (!data.identified_number || data.identified_number < 1 || data.identified_number > 2) {
      throw new BadRequestException(`Идентификационный номер обязателен и должен быть 1 или 2`);
    }
    const partner = await this.prisma.partner.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        description_ru: data.description_ru,
        description_en: data.description_en,
        status: data.status,
        identified_number: data.identified_number,
      },
    });

    return {
      status: HttpStatus.CREATED,
      data: partner,
    };
  }

  async update(id: number, data: UpdatePartnerDto) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        description_ru: true,
        description_en: true,
        status: true,
      },
    });

    if (!partner) {
      throw new NotFoundException(`Партнер не найден`);
    }

    if (
      data.identified_number &&
      (!data.identified_number || data.identified_number < 1 || data.identified_number > 2)
    ) {
      throw new BadRequestException(`Идентификационный номер обязателен и должен быть 1 или 2`);
    }

    await this.prisma.partner.update({
      where: { id },
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        description_ru: data.description_ru,
        description_en: data.description_en,
        status: data.status,
      },
    });

    return {
      status: HttpStatus.OK,
      data: partner,
    };
  }

  async remove(id: number) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException(`Партнер не найден`);
    }
    await this.prisma.partner.delete({
      where: { id },
    });

    return {
      status: HttpStatus.NO_CONTENT,
    };
  }
}
