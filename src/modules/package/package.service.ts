import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePackageDto, GetPackageDto, UpdatePackageDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetPackageDto) {
    const packages = await paginate('package', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        sms_count: true,
        minutes_count: true,
        mb_count: true,
        sku_id: true,
        status: true,
        // tariff: {
        //   select: {
        //     id: true,
        //     name_ru: true,
        //     name_en: true,
        //     description_ru: true,
        //     description_en: true,
        //     status: true,
        //     created_at: true,
        //   },
        // },
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      ...packages,
    };
  }

  async findOne(id: number) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        sms_count: true,
        minutes_count: true,
        mb_count: true,
        sku_id: true,
        status: true,
        // tariff: {
        //   select: {
        //     id: true,
        //     name_ru: true,
        //     name_en: true,
        //     description_ru: true,
        //     description_en: true,
        //     status: true,
        //     created_at: true,
        //   },
        // },
        created_at: true,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Пакет с указанным идентификатором не найден!');
    }

    return {
      status: HttpStatus.OK,
      data: packageData,
    };
  }

  async create(data: CreatePackageDto) {
    const tariff = await this.prisma.tariff.findUnique({
      where: {
        id: data.tariff_id,
      },
    });

    if (!tariff) {
      throw new NotFoundException('Тариф с указанным идентификатором не найден!');
    }

    await this.prisma.package.create({
      data: {
        sms_count: data.sms_count,
        minutes_count: data.minutes_count,
        mb_count: data.mb_count,
        sku_id: data.sku_id,
        status: data.status,
        tariff_id: data.tariff_id,
      },
    });

    return {
      status: HttpStatus.CREATED,
      message: 'Пакет успешно создан!',
    };
  }

  async update(id: number, data: UpdatePackageDto) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Пакет с указанным идентификатором не найден!');
    }

    if (data.tariff_id) {
      const tariff = await this.prisma.tariff.findUnique({
        where: {
          id: data.tariff_id,
        },
      });

      if (!tariff) {
        throw new NotFoundException('Тариф с указанным идентификатором не найден!');
      }
    }

    await this.prisma.package.update({
      where: {
        id: id,
      },
      data: {
        sms_count: data.sms_count ?? packageData.sms_count,
        minutes_count: data.minutes_count ?? packageData.minutes_count,
        mb_count: data.mb_count ?? packageData.mb_count,
        sku_id: data.sku_id ?? packageData.sku_id,
        status: data.status ?? packageData.status,
        tariff_id: data.tariff_id ?? packageData.tariff_id,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Пакет успешно обновлен!',
    };
  }

  async remove(id: number) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Пакет с указанным идентификатором не найден!');
    }

    await this.prisma.package.delete({
      where: {
        id: id,
      },
    });

    return {
      status: HttpStatus.NO_CONTENT,
      message: 'Пакет успешно удален!',
    };
  }
}
