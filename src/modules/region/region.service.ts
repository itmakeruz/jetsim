import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { paginate } from '@helpers';
import {
  FilePath,
  region_not_found,
  region_create_success,
  region_update_success,
  region_delete_success,
  region_find_success,
} from '@constants';
import { PrismaService } from '@prisma';
import { Status } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class RegionService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetRegionDto, lan: string) {
    const tariffFilter: any = {};

    if (query?.type === 'popular') tariffFilter.is_popular = true;
    if (query?.type === 'local') tariffFilter.is_local = true;
    if (query?.type === 'regional') tariffFilter.is_regional = true;
    if (query?.type === 'global') tariffFilter.is_global = true;

    const regions = await paginate('region', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort ?? { column: `name_${lan}`, value: 'asc' },
      where: {
        ...(query?.search && {
          OR: [
            { name_ru: { contains: query.search, mode: 'insensitive' } },
            { name_en: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
        status: Status.ACTIVE,

        tariffs: {
          some: {
            status: Status.ACTIVE,
            ...tariffFilter,
          },
        },
      },

      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
        created_at: true,

        tariffs: {
          where: {
            status: Status.ACTIVE,
            ...tariffFilter,
          },
          orderBy: {
            price_sell: 'asc',
          },
          take: 1,
          select: {
            id: true,
            price_sell: true,
          },
        },
      },
    });

    return {
      success: true,
      message: region_find_success[lan],
      ...regions,
      data: regions.data.map((region: any) => ({
        id: region.id,
        name: region[`name_${lan}`],
        image: `${FilePath.REGION_ICON}/${region.image}`,
        status: region.status,
        min_price: region.tariffs[0]?.price_sell / 100 || 0,
        created_at: region.created_at,
      })),
    };
  }

  async getRegionPlansByIds(ids: string, lang: string) {
    const regionIds = ids
      ? ids
          .split(',')
          .map((id) => Number(id))
          .filter(Boolean)
      : [];

    const regions = await this.prisma.region.findMany({
      where: {
        ...(regionIds.length && { id: { in: regionIds } }),
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
      },
    });

    const tariffs = await this.prisma.tariff.findMany({
      where: {
        deleted_at: null,
        status: Status.ACTIVE,
        OR: [{ regions: { some: { id: { in: regions.map((r) => r.id) } } } }, { is_global: true }],
      },
      include: {
        region_group: true,
        regions: true,
      },
      orderBy: { price_sell: 'asc' },
    });

    const grouped = {
      local: [],
      regional: {},
      global: [],
    };

    for (const plan of tariffs) {
      const formatted = {
        id: plan.id,
        name: plan[`name_${lang}`],
        price_sell: plan.price_sell / 100,
        quantity_internet: plan.quantity_internet,
        validity_period: plan.validity_period,
        region_group: plan.region_group
          ? {
              id: plan.region_group.id,
              name: plan.region_group[`name_${lang}`],
              image: `${FilePath.REGION_GROUP_ICON}/${plan.region_group.image}`,
            }
          : null,
        regions: plan.regions.map((r) => ({
          id: r.id,
          name: r[`name_${lang}`],
          image: `${FilePath.REGION_ICON}/${r.image}`,
        })),
      };

      if (plan.is_local) grouped.local.push(formatted);
      else if (plan.is_global) grouped.global.push(formatted);
      else if (plan.is_regional) {
        const key = plan.region_group?.id ?? 'no_group';
        if (!grouped.regional[key]) grouped.regional[key] = [];
        grouped.regional[key].push(formatted);
      }
    }

    return {
      success: true,
      data: {
        regions: regions.map((r) => ({
          id: r.id,
          name: r[`name_${lang}`],
          image: `${FilePath.REGION_ICON}/${r.image}`,
        })),
        tariffs: {
          local: grouped.local,
          regional: Object.values(grouped.regional),
          global: grouped.global,
        },
      },
    };
  }

  async findAllAdmin(query: GetRegionDto) {
    const regions = await paginate('region', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: {
        ...(query?.search && {
          OR: [
            {
              name_ru: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              name_en: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          ],
        }),
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
        created_at: true,
      },
    });

    return {
      success: true,
      message: region_find_success['ru'],
      ...regions,
      data: regions.data.map((region) => ({
        id: region?.id,
        name_ru: region?.name_ru,
        name_en: region?.name_en,
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        created_at: region?.created_at,
      })),
    };
  }

  async findOne(id: number, lan: string) {
    const region = await this.prisma.region.findUnique({
      where: {
        id: id,
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
        created_at: true,
      },
    });

    if (!region) {
      throw new NotFoundException(region_not_found[lan]);
    }

    return {
      success: true,
      message: region_find_success[lan],
      data: {
        id: region?.id,
        name: region?.[`name_${lan}`],
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        created_at: region?.created_at,
      },
    };
  }

  async findOneAdmin(id: number) {
    const region = await this.prisma.region.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
        created_at: true,
      },
    });

    if (!region) {
      throw new NotFoundException(region_not_found['ru']);
    }

    return {
      success: true,
      message: region_find_success['ru'],
      data: {
        id: region?.id,
        name_ru: region?.name_ru,
        name_en: region?.name_en,
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        created_at: region?.created_at,
      },
    };
  }

  async create(data: CreateRegionDto, fileName: string) {
    await this.prisma.region.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        image: fileName,
        status: data.status,
      },
    });
    return {
      success: true,
      message: region_create_success['ru'],
      data: null,
    };
  }

  async update(id: number, data: UpdateRegionDto, fileName: string) {
    const existRegion = await this.prisma.region.findUnique({
      where: {
        id: id,
      },
    });

    if (!existRegion) {
      throw new NotFoundException(region_not_found['ru']);
    }

    if (fileName) {
      const imagePath = path.join(process.cwd(), 'uploads', 'region_icons', existRegion.image);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await this.prisma.region.update({
      where: {
        id: existRegion.id,
      },
      data: {
        name_ru: data?.name_ru ?? existRegion.name_ru,
        name_en: data?.name_en ?? existRegion.name_en,
        image: fileName ?? existRegion.image,
        status: data?.status ?? existRegion.status,
      },
    });

    return {
      success: true,
      message: region_update_success['ru'],
      data: null,
    };
  }

  async remove(id: number) {
    const existRegion = await this.prisma.region.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        image: true,
      },
    });

    if (!existRegion) {
      throw new NotFoundException(region_not_found['ru']);
    }

    await this.prisma.region.delete({
      where: {
        id: existRegion.id,
      },
    });

    if (existRegion?.image) {
      const imagePath = path.join(process.cwd(), 'uploads', 'region_icons', existRegion.image);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    return {
      success: true,
      message: region_delete_success['ru'],
      data: null,
    };
  }

  /**
   *
   * REGION GROUPS
   *
   **/
}
