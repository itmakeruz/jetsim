import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartnerDto, UpdatePartnerDto, GetAllPartnerDto } from './dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';
import { partner_not_found, validation_error } from '@constants';

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
        identified_number: true,
        status: true,
      },
    });
    return {
      success: true,
      message: 'Партнеры успешно получены!',
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
        identified_number: true,
        status: true,
      },
    });

    if (!partner) {
      throw new NotFoundException(partner_not_found['ru']);
    }

    return {
      success: true,
      message: 'Партнер успешно получен!',
      data: partner,
    };
  }

  async create(data: CreatePartnerDto) {
    if (!data.identified_number || data.identified_number < 1 || data.identified_number > 2) {
      throw new BadRequestException(validation_error['ru']);
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
      success: true,
      message: 'Партнер успешно создан!',
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
        identified_number: true,
        status: true,
      },
    });

    if (!partner) {
      throw new NotFoundException(partner_not_found['ru']);
    }

    if (
      data.identified_number &&
      (!data.identified_number || data.identified_number < 1 || data.identified_number > 2)
    ) {
      throw new BadRequestException(validation_error['ru']);
    }

    await this.prisma.partner.update({
      where: {
        id: id,
      },
      data: {
        name_ru: data?.name_ru ?? partner?.name_ru,
        name_en: data?.name_en ?? partner?.name_ru,
        description_ru: data?.description_ru ?? partner?.description_ru,
        description_en: data.description_en ?? partner?.description_en,
        status: data?.status ?? partner?.status,
        identified_number: data?.identified_number ?? partner?.identified_number,
      },
    });

    return {
      success: true,
      message: 'Партнер успешно обновлен!',
      data: partner,
    };
  }

  async remove(id: number) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException(partner_not_found['ru']);
    }
    await this.prisma.partner.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Партнер успешно удален!',
    };
  }
}
