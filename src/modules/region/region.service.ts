import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { paginate, prisma } from '@helpers';

@Injectable()
export class RegionService {
  async findAll(query: GetRegionDto) {
    const regions = await paginate('region', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name_uz: true,
        name_ru: true,
        name_en: true,
        branches: {
          select: {
            id: true,
            name_uz: true,
            name_ru: true,
            name_en: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      data: regions,
    };
  }

  async findOne(id: number) {
    const region = await prisma.region.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
      select: {
        id: true,
        name_uz: true,
        name_ru: true,
        name_en: true,
        branches: {
          select: {
            id: true,
            name_uz: true,
            name_ru: true,
            name_en: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    if (!region) {
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
    }

    return {
      status: HttpStatus.OK,
      data: region,
    };
  }

  async create(data: CreateRegionDto) {
    await prisma.region.create({
      data: {
        name_uz: data.name_uz,
        name_ru: data.name_ru,
        name_en: data.name_en,
      },
    });
    return {
      status: HttpStatus.CREATED,
    };
  }

  async update(id: number, data: UpdateRegionDto) {
    const existRegion = await prisma.region.findUnique({
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

    await prisma.region.update({
      where: {
        id: existRegion.id,
      },
      data: {
        name_uz: existRegion.name_uz ?? data?.name_uz,
        name_ru: existRegion.name_ru ?? data?.name_ru,
        name_en: existRegion.name_en ?? data?.name_en,
      },
    });

    return {
      status: HttpStatus.OK,
    };
  }

  async remove(id: number) {
    const existRegion = await prisma.region.findUnique({
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

    await prisma.region.update({
      where: {
        id: existRegion.id,
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }
}
