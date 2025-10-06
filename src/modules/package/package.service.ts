import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePackageDto, GetPackageDto, UpdatePackageDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';
import {
  package_not_found,
  tariff_not_found,
  package_create_success,
  package_update_success,
  package_delete_success,
} from '@constants';

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
      throw new NotFoundException(package_not_found['ru']);
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
      throw new NotFoundException(tariff_not_found['ru']);
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
      message: package_create_success['ru'],
    };
  }

  async update(id: number, data: UpdatePackageDto) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
    });

    if (!packageData) {
      throw new NotFoundException(package_not_found['ru']);
    }

    if (data.tariff_id) {
      const tariff = await this.prisma.tariff.findUnique({
        where: {
          id: data.tariff_id,
        },
      });

      if (!tariff) {
        throw new NotFoundException(tariff_not_found['ru']);
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
      message: package_update_success['ru'],
    };
  }

  async remove(id: number) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
    });

    if (!packageData) {
      throw new NotFoundException(package_not_found['ru']);
    }

    await this.prisma.package.delete({
      where: {
        id: id,
      },
    });

    return {
      status: HttpStatus.NO_CONTENT,
      message: package_delete_success['ru'],
    };
  }
}
