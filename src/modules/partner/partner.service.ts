import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartnerDto, UpdatePartnerDto, GetAllPartnerDto } from './dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetAllPartnerDto) {
    const parners = await paginate('partner', {
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

  async create(createPartnerDto: CreatePartnerDto) {
    const partner = await this.prisma.partner.create({
      data: {
        name_ru: createPartnerDto.name_ru,
        name_en: createPartnerDto.name_en,
        description_ru: createPartnerDto.description_ru,
        description_en: createPartnerDto.description_en,
        status: createPartnerDto.status,
      },
    });

    return {
      status: HttpStatus.CREATED,
      data: partner,
    };
  }

  async update(id: number, updatePartnerDto: UpdatePartnerDto) {
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
    await this.prisma.partner.update({
      where: { id },
      data: {
        name_ru: updatePartnerDto.name_ru,
        name_en: updatePartnerDto.name_en,
        description_ru: updatePartnerDto.description_ru,
        description_en: updatePartnerDto.description_en,
        status: updatePartnerDto.status,
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
