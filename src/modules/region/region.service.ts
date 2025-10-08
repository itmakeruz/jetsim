import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateRegionCategoryDto,
  CreateRegionDto,
  GetRegionDto,
  UpdateRegionCategoryDto,
  UpdateRegionDto,
} from './dto';
import { paginate } from '@helpers';
import {
  FilePath,
  region_not_found,
  region_create_success,
  region_update_success,
  region_delete_success,
} from '@constants';
import { PrismaService } from '@prisma';
import { Status } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class RegionService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetRegionDto, lan: string) {
    const regions = await paginate('region', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: {
        OR: [
          {
            [`name_${lan}`]: {
              contains: query?.search,
              mode: 'insensitive',
            },
          },
        ],
        categories: {
          some: {
            id: +query?.category_id,
          },
        },
      },
      select: {
        id: true,
        [`name_${lan}`]: true,
        image: true,
        status: true,
        created_at: true,
        categories: true,
      },
    });

    return {
      status: HttpStatus.OK,
      ...regions,
      data: regions.data.map((region: any) => ({
        id: region?.id,
        name: region?.[`name_${lan}`],
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        created_at: region?.created_at,
        category: region?.categories?.map((category) => ({
          id: category?.id,
          name_ru: category?.name_ru,
          name_en: category?.name_en,
          icon: `${FilePath.REGION_CATEGORY_ICON}/${category?.icon}`,
          created_at: category?.created_at,
        })),
      })),
    };
  }

  async findAllAdmin(query: GetRegionDto) {
    const regions = await paginate('region', {
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
        categories: true,
        created_at: true,
      },
      where: {
        status: Status.ACTIVE,
      },
    });

    return {
      status: HttpStatus.OK,
      data: regions.data.map((region: any) => ({
        id: region?.id,
        name_ru: region?.name_ru,
        name_en: region?.name_en,
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        category: region?.categories?.map((category) => ({
          id: category?.id,
          name_ru: category?.name_ru,
          name_en: category?.name_en,
          icon: `${FilePath.REGION_CATEGORY_ICON}/${category?.icon}`,
          created_at: category?.created_at,
        })),
        created_at: region?.created_at,
      })),
    };
  }

  async findOne(id: number, lan: string) {
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
      status: HttpStatus.OK,
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
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
      },
    });

    if (!region) {
      throw new NotFoundException(region_not_found['ru']);
    }

    return {
      status: HttpStatus.OK,
      data: {
        id: region?.id,
        name_ru: region?.name_ru,
        name_en: region?.name_en,
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
      },
    };
  }

  async create(data: CreateRegionDto, fileName: string) {
    console.log(data);

    await this.prisma.region.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        image: fileName,
        status: data.status,
        categories: {
          connect: data.region_category?.map((id) => ({ id })) || [],
        },
      },
    });
    return {
      status: HttpStatus.CREATED,
      message: region_create_success['ru'],
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
      status: HttpStatus.OK,
      message: region_update_success['ru'],
    };
  }

  async remove(id: number) {
    const existRegion = await this.prisma.region.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        cities: true,
      },
    });

    if (!existRegion) {
      throw new NotFoundException(region_not_found['ru']);
    }

    if (existRegion.cities.length > 0) {
      throw new BadRequestException('Регион не может быть удален, так как есть города в нем!');
    }

    await this.prisma.region.delete({
      where: {
        id: existRegion.id,
      },
    });

    return {
      status: HttpStatus.NO_CONTENT,
      message: region_delete_success['ru'],
    };
  }

  /**
   *
   *
   * REGION CATEGORIES
   */

  async getRegionCategoryPublic(lang: string) {
    const regionCategories = await this.prisma.regionCategory.findMany({
      where: {
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        [`name_${lang}`]: true,
        icon: true,
        created_at: true,
      },
    });

    return {
      success: true,
      message: '',
      data: regionCategories?.map((category) => ({
        id: category?.id,
        name: category?.[`name_${lang}`],
        icon: `${FilePath.REGION_CATEGORY_ICON}/${category?.icon}`,
        created_at: category?.created_at,
      })),
    };
  }

  async getRegionCategoryAdmin() {
    const regionCategories = await this.prisma.regionCategory.findMany();
    return {
      success: true,
      message: '',
      data: regionCategories,
    };
  }

  async createRegionCategory(data: CreateRegionCategoryDto, fileName: string) {
    await this.prisma.regionCategory.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        icon: fileName,
      },
    });

    return {
      success: true,
      message: 'success',
      data: null,
    };
  }

  async updateRegionCategory(id: number, data: UpdateRegionCategoryDto, fileName: string) {
    const existCategoryRegion = await this.prisma.regionCategory.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        icon: true,
        name_ru: true,
        name_en: true,
      },
    });

    if (!existCategoryRegion) {
      throw new NotFoundException(region_not_found['ru']);
    }

    if (fileName) {
      const imagePath = path.join(process.cwd(), 'uploads', 'region_icons', existCategoryRegion.icon);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await this.prisma.regionCategory.update({
      where: {
        id: existCategoryRegion.id,
      },
      data: {
        name_ru: data.name_ru ?? existCategoryRegion.name_ru,
        name_en: data.name_en ?? existCategoryRegion.name_en,
        icon: fileName ?? existCategoryRegion.icon,
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'success',
      data: null,
    };
  }
}
