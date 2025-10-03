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
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        quantity_sms: true,
        quantity_minute: true,
        quantity_internet: true,
        validity_period: true,
        price_sell: true,
        regions: {
          select: {
            id: true,
            [`name_${lang}`]: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    return {
      success: true,
      message: 'success',
      data: data?.map((tariff: any) => ({
        id: tariff?.id,
        name: tariff?.[`name_${lang}`],
        title: tariff?.[`title_${lang}`],
        description: tariff?.[`description_${lang}`],
        status: tariff?.status,
        is_popular: tariff?.is_popular,
        is_4g: tariff?.is_4g,
        is_5g: tariff?.is_5g,
        quantity_sms: tariff?.quantity_sms,
        quantity_minute: tariff?.quantity_minute,
        quantity_internet: tariff?.quantity_internet,
        validity_period: tariff?.validity_period,
        price_sell: tariff?.price_sell,
        regions: tariff?.regions?.map((region) => ({
          id: region?.id,
          name: region?.[`name_${lang}`],
          created_at: region?.created_at,
        })),
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
        title_ru: true,
        title_en: true,
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        quantity_sms: true,
        quantity_minute: true,
        quantity_internet: true,
        validity_period: true,
        price_sell: true,
        price_arrival: true,
        created_at: true,
        sku_id: true,
        regions: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            created_at: true,
          },
        },
      },
    });

    return {
      success: true,
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
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        quantity_sms: true,
        quantity_minute: true,
        quantity_internet: true,
        validity_period: true,
        price_sell: true,
        created_at: true,
        regions: {
          select: {
            id: true,
            [`name_${lang}`]: true,
            created_at: true,
          },
        },
      },
    });

    if (!tariffs) {
      throw new NotFoundException('Тариф с указанным идентификатором не найдена!');
    }

    return {
      success: true,
      data: {
        id: tariffs?.id,
        name: tariffs?.[`name_${lang}`],
        title: tariffs?.[`title_${lang}`],
        status: tariffs?.status,
        is_popular: tariffs?.is_popular,
        is_4g: tariffs?.is_4g,
        is_5g: tariffs?.is_5g,
        quantity_sms: tariffs?.quantity_sms,
        quantity_minute: tariffs?.quantity_minute,
        quantity_internet: tariffs?.quantity_internet,
        validity_period: tariffs?.validity_period,
        price_sell: tariffs?.price_sell,
        regions: tariffs?.regions?.map((region) => ({
          id: region?.id,
          name: region?.[`name_${lang}`],
        })),
      },
    };
  }

  async findOneAdmin(id: number) {
    const tariff = await this.prisma.tariff.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        title_ru: true,
        title_en: true,
        status: true,
        is_popular: true,
        is_4g: true,
        is_5g: true,
        quantity_sms: true,
        quantity_minute: true,
        quantity_internet: true,
        validity_period: true,
        price_sell: true,
        price_arrival: true,
        sku_id: true,
        regions: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
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
      success: true,
      message: 'Тариф успешно найден!',
      data: tariff,
    };
  }

  async create(data: CreateTariffDto) {
    await this.prisma.tariff.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        title_ru: data.title_ru,
        title_en: data.title_en,
        status: data.status as Status,
        partner_id: data.partner_id,
        is_popular: data?.is_popular,
        is_4g: data?.is_4g,
        is_5g: data?.is_5g,
        quantity_sms: data?.quantity_sms,
        quantity_minute: data?.quantity_minute,
        quantity_internet: data?.quantity_internet,
        validity_period: data?.validity_period,
        price_sell: data?.price_sell,
        price_arrival: data?.price_arrival,
        sku_id: data?.sku_id,
        cashback_percent: data?.cashback_percent,
        regions: {
          connect:
            data.region_ids.map((region) => ({
              id: region,
            })) ?? [],
        },
      },
    });

    return {
      success: true,
      message: 'Тариф успешно создан!',
      data: null,
    };
  }

  async update(id: number, data: UpdateTariffDto) {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
      include: { regions: true },
    });

    if (!tariff) {
      throw new NotFoundException('Тариф с указанным идентификатором не найден!');
    }

    await this.prisma.tariff.update({
      where: { id },
      data: {
        name_ru: data.name_ru ?? tariff.name_ru,
        name_en: data.name_en ?? tariff.name_en,
        title_ru: data.title_ru ?? tariff.title_ru,
        title_en: data.title_en ?? tariff.title_en,
        status: (data.status as Status) ?? tariff.status,
        partner_id: data.partner_id ?? tariff.partner_id,
        is_popular: data.is_popular ?? tariff.is_popular,
        is_4g: data.is_4g ?? tariff.is_4g,
        is_5g: data.is_5g ?? tariff.is_5g,
        quantity_sms: data.quantity_sms ?? tariff.quantity_sms,
        quantity_minute: data.quantity_minute ?? tariff.quantity_minute,
        quantity_internet: data.quantity_internet ?? tariff.quantity_internet,
        validity_period: data.validity_period ?? tariff.validity_period,
        price_sell: data.price_sell ?? tariff.price_sell,
        price_arrival: data.price_arrival ?? tariff.price_arrival,
        sku_id: data.sku_id ?? tariff.sku_id,
        cashback_percent: data.cashback_percent ?? tariff.cashback_percent,
        regions: data.region_ids
          ? {
              set: data.region_ids.map((regionId) => ({ id: regionId })),
            }
          : undefined,

        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Тариф успешно обновлен!',
      data: null,
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
      success: true,
      message: 'Статус тарифа успешно обновлен!',
      data: null,
    };
  }

  // async changeStatusPackage(id: number, status: Status) {
  //   const packageData = await this.prisma.package.findUnique({
  //     where: {
  //       id: id,
  //     },
  //   });

  //   if (!packageData) {
  //     throw new NotFoundException('Пакет с указанным идентификатором не найдена!');
  //   }

  //   if (status === packageData.status) {
  //     throw new BadRequestException(`Статус пакета ${packageData.status} уже установлен!`);
  //   }

  //   await this.prisma.package.update({
  //     where: {
  //       id: packageData.id,
  //     },
  //     data: {
  //       status: status,
  //     },
  //   });

  //   return {
  //     status: HttpStatus.OK,
  //     message: 'Статус пакета успешно обновлен!',
  //   };
  // }

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
      success: true,
      message: 'Тариф успешно удален!',
      data: null,
    };
  }

  // async removePackage(id: number) {
  //   const packageData = await this.prisma.package.findUnique({
  //     where: {
  //       id: id,
  //     },
  //   });

  //   if (!packageData) {
  //     throw new NotFoundException('Пакет с указанным идентификатором не найдена!');
  //   }

  //   await this.prisma.package.delete({
  //     where: {
  //       id: packageData.id,
  //     },
  //   });

  //   return {
  //     status: HttpStatus.NO_CONTENT,
  //     message: 'Пакет успешно удален!',
  //   };
  // }
}
