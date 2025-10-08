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
  TariffType,
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
        [`name_${lan}`]: {
          contains: query?.search,
          mode: 'insensitive',
        },
        categories: {
          some: {
            id: query.category_id,
          },
        },
      },
      select: {
        id: true,
        [`name_${lan}`]: true,
        image: true,
        status: true,
        tariffs: {
          select: {
            id: true,
            status: true,
            type: true,
            quantity_sms: true,
            quantity_minute: true,
            quantity_internet: true,
            validity_period: true,
            is_4g: true,
            is_5g: true,
            regions: {
              select: {
                id: true,
                [`name_${lan}`]: true,
                image: true,
                status: true,
                created_at: true,
              },
            },
          },
        },
        created_at: true,
      },
    });

    return {
      success: true,
      message: '',
      data: regions.data.map((region: any) => ({
        id: region?.id,
        name: region?.[`name_${lan}`],
        image: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        tariffs: region?.tariffs?.map((tariff: any) => ({
          id: tariff?.id,
          status: tariff?.status,
          type: TariffType[tariff?.type][lan],
          quantity_sms: tariff?.quantity_sms,
          quantity_minute: tariff?.quantity_minute,
          quantity_internet: tariff?.quantity_internet,
          validity_period: tariff?.validity_period,
          is_4g: tariff?.is_4g,
          is_5g: tariff?.is_5g,
          regions: tariff?.map((region) => ({
            id: region?.id,
            name: region?.[`name_${lan}`],
            image: `${FilePath.REGION_ICON}/${region?.image}`,
            status: region?.status,
          })),
        })),
        // category: region?.categories?.map((category) => ({
        //   id: category?.id,
        //   name_ru: category?.name_ru,
        //   name_en: category?.name_en,
        //   icon: `${FilePath.REGION_CATEGORY_ICON}/${category?.icon}`,
        //   created_at: category?.created_at,
        // })),
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
      success: true,
      message: '',
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
      success: true,
      message: null,
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
      success: true,
      message: '',
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
        categories: {
          connect: data.region_category?.map((id) => ({ id })) || [],
        },
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
      success: true,
      message: region_delete_success['ru'],
      data: null,
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
