import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionGroupDto } from './dto/create-region_group.dto';
import { UpdateRegionGroupDto } from './dto/update-region_group.dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';
import {
  FilePath,
  region_group_create,
  region_group_delete,
  region_group_find,
  region_group_find_one,
  region_group_not_found,
  region_group_update,
  region_not_found,
  tariffs_loaded,
} from '@constants';
import * as path from 'path';
import * as fs from 'fs';
import { Status } from '@prisma/client';

@Injectable()
export class RegionGroupService {
  constructor(private readonly prisma: PrismaService) {}
  async findRegionGroups(query: any, lan: string) {
    const tariffFilter: any = {};

    if (query?.type === 'popular') tariffFilter.is_popular = true;
    if (query?.type === 'local') tariffFilter.is_local = true;
    if (query?.type === 'regional') tariffFilter.is_regional = true;
    if (query?.type === 'global') tariffFilter.is_global = true;

    const regionGroups = await paginate('regionGroup', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,

      where: {
        status: Status.ACTIVE,
        tariffs: {
          some: {
            status: Status.ACTIVE,
            deleted_at: null,
            ...tariffFilter,
          },
        },
      },

      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        created_at: true,

        regions: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            image: true,
          },
        },

        tariffs: {
          where: {
            status: Status.ACTIVE,
            deleted_at: null,
            ...tariffFilter,
          },
          orderBy: { price_sell: 'asc' },
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
      data: regionGroups.data.map((group: any) => ({
        id: group.id,
        name: group[`name_${lan}`],
        image: `${FilePath.REGION_GROUP_ICON}/${group.image}`,
        min_price: group.tariffs[0]?.price_sell ?? 0,
        regions: group.regions.map((r) => ({
          id: r.id,
          name: r[`name_${lan}`],
          image: `${FilePath.REGION_ICON}/${r.image}`,
        })),
        created_at: group.created_at,
      })),
      meta: regionGroups.meta,
    };
  }

  async findRegionGroupsAdmin(query: any) {
    const regionGroups = await paginate('regionGroup', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
        regions: true,
        created_at: true,
      },
    });

    return {
      success: true,
      message: region_group_find['ru'],
      ...regionGroups,
      data: regionGroups.data.map((region: any) => ({
        id: region?.id,
        name_ru: region?.name_ru,
        name_en: region?.name_en,
        image: `${FilePath.REGION_GROUP_ICON}/${region?.image}`,
        status: region?.status,
        regions: region?.regions.map((reg) => ({
          id: reg.id,
          name_ru: reg?.name_ru,
          name_en: reg?.name_en,
          image: `${FilePath.REGION_ICON}/${reg?.image}`,
          status: reg.status,
          created_at: reg.created_at,
        })),
        created_at: region?.created_at,
      })),
    };
  }

  async getPlansUniversal(groupId: number | null, lang: string, regionIds: string | null) {
    const ids = regionIds ? regionIds.split('-').map(Number).filter(Boolean) : [];

    let regions: number[] = [];
    let groups: any[] = [];

    if (groupId) {
      const group = await this.prisma.regionGroup.findUnique({
        where: { id: groupId },
        include: { regions: true },
      });
      if (group) {
        groups = [group];
        regions = group.regions.map((r) => r.id);
      }
    }

    if (ids.length > 0) {
      regions = ids;
      groups = await this.prisma.regionGroup.findMany({
        where: { regions: { some: { id: { in: ids } } } },
        include: { regions: true },
      });
    }

    const where: any = {
      deleted_at: null,
      status: 'ACTIVE',
    };

    if (groups.length > 0) {
      where.OR = [{ region_group_id: { in: groups.map((g) => g.id) } }, { is_global: true }];
    } else if (regions.length > 0) {
      where.OR = [{ regions: { some: { id: { in: regions } } } }, { is_global: true }];
    } else {
      where.is_global = true;
    }

    // TO'G'RI SELECT — faqat mavjud maydonlar + relationlar
    const tariffs = await this.prisma.tariff.findMany({
      where,
      select: {
        id: true,
        price_sell: true,
        quantity_internet: true,
        validity_period: true,
        is_global: true,
        is_regional: true,
        is_local: true,

        // Faqat mavjud tillar
        name_ru: true,
        name_en: true,

        // Relationlarni to'g'ri select qilamiz
        region_group: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            image: true,
          },
        },
        regions: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            image: true,
          },
        },
      },
      orderBy: { price_sell: 'asc' },
    });

    const result = {
      local: [] as any[],
      regional: {} as Record<string, any[]>,
      global: [] as any[],
    };

    for (const plan of tariffs) {
      const formatted = {
        id: plan.id,
        name: (plan as any)[`name_${lang}`] || plan.name_ru || 'Без названия',
        price_sell: plan.price_sell,
        quantity_internet: plan.quantity_internet,
        validity_period: plan.validity_period,

        region_group: plan.region_group
          ? {
              id: plan.region_group.id,
              name: (plan.region_group as any)[`name_${lang}`] || plan.region_group.name_ru || 'Группа',
              image: plan.region_group.image ? `${FilePath.REGION_GROUP_ICON}/${plan.region_group.image}` : null,
            }
          : null,

        regions: plan.regions.map((r: any) => ({
          id: r.id,
          name: r[`name_${lang}`] || r.name_ru || 'Регион',
          image: r.image ? `${FilePath.REGION_ICON}/${r.image}` : null,
        })),
      };

      if (plan.is_global) {
        result.global.push(formatted);
      } else if (plan.is_regional) {
        const key = plan.region_group?.id?.toString() ?? 'no_group';
        if (!result.regional[key]) result.regional[key] = [];
        result.regional[key].push(formatted);
      } else if (plan.is_local) {
        result.local.push(formatted);
      }
    }

    // Tanlangan regionlar (faqat regionIds bo'lsa)
    const selectedRegions = regions.length
      ? await this.prisma.region.findMany({
          where: { id: { in: regions } },
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            image: true,
          },
        })
      : [];

    const formattedRegions = selectedRegions.map((r: any) => ({
      id: r.id,
      name: r[`name_${lang}`] || r.name_ru || 'Регион',
      image: r.image ? `${FilePath.REGION_ICON}/${r.image}` : null,
    }));

    return {
      success: true,
      data: {
        regions: formattedRegions,
        tariffs: {
          local: result.local,
          regional: Object.values(result.regional),
          global: result.global,
        },
      },
    };
  }

  async findRegionOneRegionGroup(id: number) {
    const regionGroup = await this.prisma.regionGroup.findUnique({
      where: {
        id: id,
      },
    });

    if (!regionGroup) {
      throw new NotFoundException(region_group_not_found['ru']);
    }

    return {
      success: true,
      message: region_group_find_one['ru'],
      data: regionGroup,
    };
  }

  async createRegionGroup(data: CreateRegionGroupDto, fileName: string) {
    await this.prisma.regionGroup.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        image: fileName,
        status: data?.status,
        regions: {
          connect: data?.region_ids?.map((id) => ({ id })) || [],
        },
      },
    });

    return {
      success: true,
      message: region_group_create['ru'],
      data: null,
    };
  }

  async updateRegionGroup(id: number, data: UpdateRegionGroupDto, fileName: string) {
    const regionGroup = await this.prisma.regionGroup.findUnique({
      where: {
        id: id,
      },
    });

    if (!regionGroup) {
      throw new NotFoundException(region_not_found['ru']);
    }

    if (fileName) {
      const imagePath = path.join(process.cwd(), 'uploads', 'region_group_icons', regionGroup.image);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await this.prisma.regionGroup.update({
      where: {
        id: id,
      },
      data: {
        name_ru: data.name_ru ?? regionGroup.name_ru,
        name_en: data.name_en ?? regionGroup.name_en,
        status: data.status ?? regionGroup.status,
        image: data.image ?? regionGroup.image,
        regions: {
          set: data.region_ids?.map((id) => ({ id })) || [],
        },
      },
    });

    return {
      success: true,
      message: region_group_update['ru'],
      data: null,
    };
  }

  async removeRegionGroup(id: number) {
    const regionGroup = await this.prisma.regionGroup.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        image: true,
      },
    });

    if (!regionGroup) {
      throw new NotFoundException(region_not_found['ru']);
    }

    await this.prisma.regionGroup.delete({
      where: {
        id: id,
      },
    });

    if (regionGroup?.image) {
      const imagePath = path.join(process.cwd(), 'uploads', 'region_group_icons', regionGroup.image);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    return {
      success: true,
      message: region_group_delete['ru'],
      data: null,
    };
  }
}
