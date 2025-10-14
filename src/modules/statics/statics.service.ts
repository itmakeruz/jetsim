import { statics_identification } from '@constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { CreateTariffType, UpdateTariffType } from './dto';

@Injectable()
export class StaticsService {
  constructor(private readonly prisma: PrismaService) {}
  async findAllTariffTypes() {
    const tariffTypes = await this.prisma.staticTypes.findMany({
      where: {
        identification_number: statics_identification.TARIFF_TYPE,
      },
    });

    return {
      success: true,
      message: '',
      data: tariffTypes,
    };
  }

  async findOneTariffTypes(id: number) {
    const tariffType = await this.prisma.staticTypes.findUnique({
      where: {
        id: id,
      },
    });

    if (!tariffType) {
      throw new NotFoundException('Not Found');
    }

    return {
      success: true,
      message: '',
      data: tariffType,
    };
  }

  async createTariffType(data: CreateTariffType) {
    await this.prisma.staticTypes.create({
      data: {
        name_ru: data?.name_ru,
        name_en: data?.name_en,
        identification_number: statics_identification.TARIFF_TYPE,
      },
    });

    return {
      success: true,
      message: 'created',
      data: null,
    };
  }

  async updateTariffType(id: number, data: UpdateTariffType) {
    const tariffType = await this.prisma.staticTypes.findUnique({
      where: {
        id: id,
      },
    });

    if (!tariffType) {
      throw new NotFoundException('Not Found');
    }

    await this.prisma.staticTypes.update({
      where: {
        id: id,
      },
      data: {
        name_ru: data?.name_ru ?? tariffType?.name_ru,
        name_en: data?.name_en ?? tariffType?.name_en,
      },
    });

    return {
      success: true,
      message: 'updated',
      data: null,
    };
  }

  async deleteTariffType(id: number) {
    const tariffType = await this.prisma.staticTypes.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
      },
    });

    if (!tariffType) {
      throw new NotFoundException('Not Found');
    }

    await this.prisma.staticTypes.delete({
      where: {
        id: id,
      },
    });

    return {
      success: true,
      message: 'deleted',
      data: null,
    };
  }
}
