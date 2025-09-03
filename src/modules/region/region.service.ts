import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { paginate } from '@helpers';
import { FilePath } from '@constants';
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
          {
            cities: {
              some: {
                [`name_${lan}`]: {
                  contains: query?.search,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        [`name_${lan}`]: true,
        image: true,
        status: true,
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
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
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        image: true,
        status: true,
        created_at: true,
      },
      where: {
        status: Status.ACTIVE,
      },
    });

    return {
      status: HttpStatus.OK,
      data: regions.data.map((region) => ({
        id: region?.id,
        name_ru: region?.name_ru,
        name_en: region?.name_en,
        image: region?.image ? `${FilePath.REGION_ICON}/${region?.image}` : null,
        status: region?.status,
        created_at: region?.created_at,
      })),
      ...regions,
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
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
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
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
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
    await this.prisma.region.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        image: fileName,
        status: data.status,
      },
    });
    return {
      status: HttpStatus.CREATED,
      message: 'Регион успешно создан!',
    };
  }

  async update(id: number, data: UpdateRegionDto, fileName: string) {
    const existRegion = await this.prisma.region.findUnique({
      where: {
        id: id,
      },
    });

    if (!existRegion) {
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
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
      message: 'Регион успешно обновлен!',
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
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
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
      message: 'Регион успешно удален!',
    };
  }
}
