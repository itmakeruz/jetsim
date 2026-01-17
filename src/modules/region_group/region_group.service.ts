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
  route_not_found,
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
        min_price: group.tariffs[0]?.price_sell / 100 || 0,
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

  async getPlansUniversal(groupId: number | null, regionIds: string | null, lang: string) {
    // 0️⃣ ID larni tozalash
    const ids = regionIds
      ? Array.from(
          new Set(
            regionIds
              .split('-')
              .map(Number)
              .filter((id) => !isNaN(id) && id > 0),
          ),
        )
      : [];

    let regions: any[] = [];
    let groupRegionIds: number[] = []; // Guruh ichidagi davlatlar ID lari

    // 1️⃣ Regionlarni aniqlash (Header qismi uchun)
    if (ids.length > 0) {
      // User aniq davlatlarni tanladi
      const dbRegions = await this.prisma.region.findMany({
        where: { id: { in: ids } },
        select: { id: true, name_ru: true, name_en: true, image: true },
      });

      if (dbRegions.length !== ids.length) throw new NotFoundException(route_not_found[lang]);

      regions = dbRegions.map((r) => ({
        id: r.id,
        name: r[`name_${lang}`] || r.name_ru,
        image: r.image ? `${FilePath.REGION_ICON}/${r.image}` : null,
      }));
    } else if (groupId) {
      // User Guruh tanladi
      const group = await this.prisma.regionGroup.findUnique({
        where: { id: groupId },
        include: { regions: { select: { id: true } } }, // Faqat ID larni olamiz yengil bo'lishi uchun
      });

      if (!group) throw new NotFoundException(route_not_found[lang]);

      // Headerga guruhni chiqaramiz
      regions = [
        {
          id: group.id,
          name: group[`name_${lang}`] || group.name_ru,
          image: group.image ? `${FilePath.REGION_GROUP_ICON}/${group.image}` : null,
        },
      ];

      // Guruh ichidagi barcha region ID larni saqlab olamiz (Local tariflar uchun kerak)
      groupRegionIds = group.regions.map((r) => r.id);
    }

    // 2️⃣ WHERE SHARTINI YASASH (ENG MUHIM JOYI)
    const where: any = {
      deleted_at: null,
      status: 'ACTIVE',
      OR: [], // OR massivini toza ochamiz
    };

    // 🅰️ SCENARIO 1: Aniq davlatlar tanlangan (regionIds bor)
    if (ids.length > 0) {
      where.OR.push(
        // 1. LOCAL: Shu davlatlarning o'z tariflari
        { is_local: true, regions: { some: { id: { in: ids } } } },

        // 2. REGIONAL: Shu davlatlar kirgan har qanday regional tarif (Group yoki Custom)
        {
          is_regional: true,
          OR: [
            { region_group: { regions: { some: { id: { in: ids } } } } },
            { regions: { some: { id: { in: ids } } } },
          ],
        },

        // 3. GLOBAL: Shu davlatlarda ishlaydigan globallar
        { is_global: true, regions: { some: { id: { in: ids } } } },
      );
    }
    // 🅱️ SCENARIO 2: Guruh tanlangan (groupId bor)
    else if (groupId) {
      where.OR.push(
        // 1. LOCAL: Guruh ichidagi davlatlarning shaxsiy tariflari
        // (Masalan: Yevropani tanlasa ham, ichidagi Fransiya tarifini ko'rsatish)
        {
          is_local: true,
          regions: { some: { id: { in: groupRegionIds } } },
        },

        // 2. REGIONAL: 🔥 QAT'IY FILTR 🔥
        // Faqat va faqat tanlangan guruhga tegishli tarif chiqadi.
        // Boshqa "kesishuvchi" guruhlar chiqmaydi.
        {
          is_regional: true,
          region_group_id: groupId,
        },

        // 3. GLOBAL: Hamma joyda ishlaydigan tariflar
        { is_global: true },
      );
    }
    // 🅾️ SCENARIO 3: Hech narsa tanlanmagan
    else {
      where.OR.push({ is_global: true });
    }

    // 3️⃣ BAZADAN OLISH
    const tariffs = await this.prisma.tariff.findMany({
      where,
      include: {
        region_group: { include: { regions: true } },
        regions: true,
      },
      orderBy: { price_sell: 'asc' },
    });

    // 4️⃣ FORMATLASH VA AJRATISH
    const result = { local: [], regional: [], global: [] };

    for (const plan of tariffs) {
      const formatted = {
        id: plan.id,
        name: plan[`name_${lang}`] || plan.name_ru,
        price_sell: plan.price_sell / 100,
        quantity_internet: plan.quantity_internet,
        quantity_sms: plan.quantity_sms,
        quantity_minute: plan.quantity_minute,
        includes_minutes: plan.quantity_minute > 0,
        includes_sms: plan.quantity_sms > 0,
        includes_internet: plan.quantity_internet > 0,
        is_4g: plan.is_4g,
        is_5g: plan.is_5g,
        description: plan[`title_${lang}`] || plan.title_ru,
        validity_period: plan.validity_period,
        region_group: plan.region_group
          ? {
              id: plan.region_group.id,
              name: plan.region_group[`name_${lang}`] || plan.region_group.name_ru,
              image: plan.region_group.image ? `${FilePath.REGION_GROUP_ICON}/${plan.region_group.image}` : null,
            }
          : null,
        regions: plan.regions.map((r) => ({
          id: r.id,
          name: r[`name_${lang}`] || r.name_ru,
          image: r.image ? `${FilePath.REGION_ICON}/${r.image}` : null,
        })),
      };

      if (plan.is_global) result.global.push(formatted);
      else if (plan.is_regional) result.regional.push(formatted);
      else if (plan.is_local) result.local.push(formatted);
    }

    return {
      success: true,
      data: {
        regions,
        tariffs: result,
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
        image: fileName ?? regionGroup.image,
        regions: {
          set: data.region_ids?.map((id) => ({ id })) || [],
        },
      },
    });

    const findTariff = await this.prisma.tariff.findMany({
      where: {
        region_group_id: regionGroup?.id,
      },
      select: {
        id: true,
      },
    });

    for (let tariff of findTariff) {
      await this.prisma.tariff.update({
        where: {
          id: tariff?.id,
        },
        data: {
          regions: {
            set: data.region_ids?.map((id) => ({ id })) || [],
          },
        },
      });
    }

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
