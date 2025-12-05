import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionDto, CreateRegionGroupDto, GetRegionDto, UpdateRegionDto, UpdateRegionGroupDto } from './dto';
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
    const where: any = {};
    if (query?.type && query?.type === 'popular') {
      where.is_popular = true;
    }
    if (query?.type && query?.type === 'local') {
      where.is_local = true;
    }
    if (query?.type && query?.type === 'regional') {
      where.is_regional = true;
    }
    if (query?.type && query?.type === 'global') {
      where.is_global = true;
    }
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
        tariffs: {
          some: {
            ...where
          }
        },
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

    return {
      success: true,
      message: region_find_success[lan],
      ...regions,
      data: regions.data.map((region) => ({
        id: region?.id,
        name: region?.[`name_${lan}`],
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        created_at: region?.created_at,
      })),
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
