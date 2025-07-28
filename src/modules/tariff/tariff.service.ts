import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTariffDto, GetTarifftDto, UpdateTariffDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';
import { Status } from '@prisma/client';

@Injectable()
export class TariffService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetTarifftDto, lang: string) {
    const { data, ...meta } = await paginate('tariff', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: {
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        [`name_${lang}`]: true,
        [`title_${lang}`]: true,
        [`description_${lang}`]: true,
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        regions: {
          select: {
            id: true,
            [`name_${lang}`]: true,
            created_at: true,
          },
        },
        _count: {
          select: {
            package: true,
          },
        },
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      data: data?.map((tariff: any) => ({
        id: tariff?.id,
        name: tariff?.[`name_${lang}`],
        title: tariff?.[`title_${lang}`],
        description: tariff?.[`description_${lang}`],
        status: tariff?.status,
        is_popular: tariff?.is_popular,
        is_4g: tariff?.is_4g,
        is_5g: tariff?.is_5g,
        regions: tariff?.regions?.map((region) => ({
          id: region?.id,
          name: region?.[`name_${lang}`],
          created_at: region?.created_at,
        })),
        package_count: tariff?._count?.package,
        created_at: tariff?.created_at,
      })),
      ...meta,
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
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        regions: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            created_at: true,
          },
        },
        _count: {
          select: {
            package: true,
          },
        },
        created_at: true,
      },
      where: {
        status: Status.ACTIVE,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Тарифы успешно найдены!',
      data: tariffs?.data?.map((tariff: any) => ({
        ...tariff,
        package_count: tariff?._count?.package,
      })),
      ...tariffs,
    };
  }

  async findOne(id: number, lang: string) {
    const tariffs = await this.prisma.tariff.findUnique({
      where: {
        id: id,
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        [`name_${lang}`]: true,
        [`title_${lang}`]: true,
        [`description_${lang}`]: true,
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        regions: {
          select: {
            id: true,
            [`name_${lang}`]: true,
            created_at: true,
          },
        },
        package: {
          select: {
            id: true,
            sms_count: true,
            minutes_count: true,
            mb_count: true,
            sku_id: true,
            status: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    if (!tariffs) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    return {
      status: HttpStatus.OK,
      data: {
        id: tariffs?.id,
        name: tariffs?.[`name_${lang}`],
        title: tariffs?.[`title_${lang}`],
        description: tariffs?.[`description_${lang}`],
        status: tariffs?.status,
        is_popular: tariffs?.is_popular,
        is_4g: tariffs?.is_4g,
        is_5g: tariffs?.is_5g,
        regions: tariffs?.regions?.map((region) => ({
          id: region?.id,
          name: region?.[`name_${lang}`],
        })),
        package: tariffs?.package?.map((pck) => ({
          id: pck?.id,
          sms_count: pck?.sms_count,
          minutes_count: pck?.minutes_count,
          mb_count: pck?.mb_count,
          sku_id: pck?.sku_id,
          status: pck?.status,
          created_at: pck?.created_at,
        })),
      },
    };
  }

  async findOneAdmin(id: number) {
    const tariff = await this.prisma.tariff.findUnique({
      where: {
        id: id,
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        description_ru: true,
        description_en: true,
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        regions: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            created_at: true,
          },
        },
        package: {
          select: {
            id: true,
            sms_count: true,
            minutes_count: true,
            mb_count: true,
            sku_id: true,
            status: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    if (!tariff) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    return {
      status: HttpStatus.OK,
      message: 'Тариф успешно найден!',
      data: tariff,
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
        regions: {
          connect:
            data.region_ids.map((region) => ({
              id: region,
            })) ?? [],
        },
        package: {
          create: data.packages.map((pck) => ({
            sms_count: pck.sms_count,
            minutes_count: pck.minutes_count,
            mb_count: pck.mb_count,
            sku_id: pck.sku_id,
            status: pck.status as Status,
          })),
        },
      },
    });

    return {
      status: HttpStatus.CREATED,
      message: 'Тариф успешно создан!',
    };
  }

  async update(id: number, data: UpdateTariffDto) {
    const service = await this.prisma.tariff.findUnique({
      where: {
        id: id,
      },
    });

    if (!service) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    await this.prisma.tariff.update({
      where: {
        id: id,
      },
      data: {
        name_ru: service?.name_ru ?? data?.name_ru,
        name_en: service?.name_en ?? data?.name_en,
        description_ru: service?.description_ru ?? data?.description_ru,
        description_en: service?.description_en ?? data?.description_en,
        regions: {
          set:
            data.region_ids?.map((region) => ({
              id: region,
            })) ?? [],
        },
        updated_at: new Date(),
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Тариф успешно обновлен!',
    };
  }

  async changeStatusTariff(id: number, status: Status) {
    const tariff = await this.prisma.tariff.findUnique({
      where: {
        id: id,
      },
    });

    if (!tariff) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    if (status === tariff.status) {
      throw new BadRequestException(`Статус тарифа ${tariff.status} уже установлен!`);
    }

    await this.prisma.tariff.update({
      where: {
        id: id,
      },
      data: {
        status: status,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Статус тарифа успешно обновлен!',
    };
  }

  async changeStatusPackage(id: number, status: Status) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Пакет с указанным идентификатором не найдена!');
    }

    if (status === packageData.status) {
      throw new BadRequestException(`Статус пакета ${packageData.status} уже установлен!`);
    }

    await this.prisma.package.delete({
      where: {
        id: packageData.id,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Статус пакета успешно обновлен!',
    };
  }

  async remove(id: number) {
    const service = await this.prisma.tariff.findUnique({
      where: {
        id: id,
      },
    });

    if (!service) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    await this.prisma.tariff.delete({
      where: {
        id: service.id,
      },
    });
    return {
      status: HttpStatus.NO_CONTENT,
      message: 'Тариф успешно удален!',
    };
  }

  async removePackage(id: number) {
    const packageData = await this.prisma.package.findUnique({
      where: {
        id: id,
      },
    });

    if (!packageData) {
      throw new NotFoundException('Пакет с указанным идентификатором не найдена!');
    }

    await this.prisma.package.delete({
      where: {
        id: packageData.id,
      },
    });

    return {
      status: HttpStatus.NO_CONTENT,
      message: 'Пакет успешно удален!',
    };
  }
}
