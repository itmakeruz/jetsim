import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionGroupDto } from './dto/create-region_group.dto';
import { UpdateRegionGroupDto } from './dto/update-region_group.dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';
import {
  FilePath,
  region_find_success,
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
import { GetRegionDto } from '../region/dto';
import { Status } from '@prisma/client';

@Injectable()
export class RegionGroupService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetRegionDto, lan: string) {
    // Tarif filterlari
    const tariffWhere: any = { deleted_at: null };

    if (query?.type === 'popular') tariffWhere.is_popular = true;
    else if (query?.type === 'local') tariffWhere.is_local = true;
    else if (query?.type === 'regional') tariffWhere.is_regional = true;
    else if (query?.type === 'global') tariffWhere.is_global = true;

    // Region filterlari
    const regionWhere: any = {
      status: Status.ACTIVE,
      tariffs: { some: tariffWhere }, // regionni faqat tarif mavjud bo‘lsa chiqaradi
    };

    if (query?.search) {
      regionWhere.OR = [
        { name_ru: { contains: query.search, mode: 'insensitive' } },
        { name_en: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // RegionGroup query
    const regionGroups = await paginate('regionGroup', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: {}, // agar regionGroup uchun alohida filter bo‘lsa shu yerda qo‘shish mumkin
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        regions: {
          where: regionWhere,
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            image: true,
            status: true,
            created_at: true,
            tariffs: {
              where: tariffWhere,
              orderBy: { price_sell: 'asc' },
              take: 1,
              select: { id: true, price_sell: true },
            },
          },
        },
        created_at: true,
      },
    });

    return {
      success: true,
      message: region_find_success[lan],
      ...regionGroups,
      data: regionGroups.data.map((group: any) => ({
        id: group.id,
        name: group[`name_${lan}`],
        created_at: group.created_at,
        regions: group.regions.map((region: any) => ({
          id: region.id,
          name: region[`name_${lan}`],
          image: `${FilePath.REGION_ICON}/${region.image}`,
          status: region.status,
          min_price: region.tariffs[0]?.price_sell ?? 0,
          created_at: region.created_at,
        })),
      })),
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

  async getRegionGroupPlans(regionGroupId: number, lang: string) {
    const regionGroup = await this.prisma.regionGroup.findUnique({
      where: {
        id: regionGroupId,
      },
    });

    const plans = await this.prisma.tariff.findMany({
      where: {
        OR: [
          {
            regions: {
              some: {
                id: regionGroup.id,
              },
            },
          },
          {
            is_global: true,
          },
        ],
        deleted_at: null,
        status: 'ACTIVE',
      },
      include: {
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
      orderBy: {
        created_at: 'desc',
      },
    });

    const grouped = {
      regional: [],
      global: [],
    };

    for (const plan of plans) {
      const formatted = {
        id: plan.id,
        name: plan?.[`name_${lang}`],
        price_sell: plan.price_sell,
        quantity_internet: plan.quantity_internet,
        validity_period: plan.validity_period,
        region_group: plan.region_group
          ? {
              id: plan.region_group.id,
              name: plan.region_group?.[`name_${lang}`],
              image: `${FilePath.REGION_GROUP_ICON}/${plan?.region_group?.image}`,
            }
          : null,
        regions: plan.regions.map((r) => ({
          id: r.id,
          name: r?.[`name_${lang}`],
          image: `${FilePath.REGION_ICON}/${r?.image}`,
        })),
      };

      if (plan.is_regional) grouped.regional.push(formatted);
      else if (plan.is_global) grouped.global.push(formatted);
    }

    // const groupedRegionals = {};

    // for (const plan of grouped.regional) {
    //   const key = plan.region_group?.id;

    //   if (!groupedRegionals[key]) {
    //     groupedRegionals[key] = {
    //       ...plan.region_group,
    //       tariffs: [],
    //     };
    //   }

    //   groupedRegionals[key].tariffs.push(plan);
    // }

    return {
      success: true,
      message: tariffs_loaded[lang],
      data: {
        id: regionGroup.id,
        name: regionGroup?.[`name_${lang}`],
        image: `${FilePath.REGION_ICON}/${regionGroup?.image}`,
        regional: grouped.regional,
        global: grouped.global,
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
