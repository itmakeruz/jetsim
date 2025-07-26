import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { paginate } from '@helpers';
import { FilePath } from '@constants';
import { PrismaService } from '@prisma';

@Injectable()
export class RegionService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: GetRegionDto, lan: string) {
    const regions = await paginate('region', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        [`name_${lan}`]: true,
        [`description_${lan}`]: true,
        image: true,
        status: true,
        created_at: true,
      },
      where: {
        deleted_at: {
          equals: null,
        },
      },
    });

    return {
      status: HttpStatus.OK,
      data: {
        ...regions,
        data: regions.data.map((region) => ({
          id: region?.id,
          name: region?.[`name_${lan}`],
          description: region?.[`description_${lan}`],
          icon: `${FilePath.REGION_ICON}/${region?.image}`,
          status: region?.status,
          created_at: region?.created_at,
        })),
      },
    };
  }

  async findAllAdmin(query: GetRegionDto, lan: string) {
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
        deleted_at: {
          equals: null,
        },
      },
    });

    return {
      status: HttpStatus.OK,
      data: {
        ...regions,
        data: regions.data.map((region) => ({
          id: region?.id,
          name_ru: region?.name_ru,
          name_en: region?.name_en,
          icon: region?.image ? `${FilePath.REGION_ICON}/${region?.image}` : null,
          status: region?.status,
          created_at: region?.created_at,
        })),
      },
    };
  }

  async findOne(id: number, lan: string) {
    const region = await this.prisma.region.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
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
        description: region?.[`description_${lan}`],
        icon: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
        created_at: region?.created_at,
      },
    };
  }

  async findOneAdmin(id: number) {
    const region = await this.prisma.region.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
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
        icon: `${FilePath.REGION_ICON}/${region?.image}`,
        status: region?.status,
      },
    };
  }

  async create(data: CreateRegionDto) {
    await this.prisma.region.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        image: data.icon,
        status: data.status,
      },
    });
    return {
      status: HttpStatus.CREATED,
    };
  }

  async update(id: number, data: UpdateRegionDto) {
    const existRegion = await this.prisma.region.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!existRegion) {
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
    }

    await this.prisma.region.update({
      where: {
        id: existRegion.id,
      },
      data: {
        name_ru: existRegion.name_ru ?? data?.name_ru,
        name_en: existRegion.name_en ?? data?.name_en,
        image: existRegion.image ?? data?.icon,
        status: existRegion.status ?? data?.status,
      },
    });

    return {
      status: HttpStatus.OK,
    };
  }

  async remove(id: number) {
    const existRegion = await this.prisma.region.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
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

    await this.prisma.region.update({
      where: {
        id: existRegion.id,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    return {
      status: HttpStatus.NO_CONTENT,
    };
  }
}
