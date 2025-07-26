import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCityDto, GetCityDto, UpdateCityDto } from './dto';
import { paginate } from '@helpers';
import { PrismaService } from '@prisma';
import { Status } from '@prisma/client';

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetCityDto, lan: string) {
    const cities = await paginate('city', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        [`name_${lan}`]: true,
        status: true,
        created_at: true,
      },
    });

    return {
      ...cities,
      data: cities?.data?.map((city) => ({
        id: city?.id,
        name: city[`name_${lan}`],
        status: city?.status,
        created_at: city?.created_at,
      })),
    };
  }

  async findAllAdmin(query: GetCityDto) {
    const cities = await paginate('city', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        status: true,
        created_at: true,
      },
    });

    return cities;
  }

  async findOne(id: number, lan: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      select: {
        id: true,
        [`name_${lan}`]: true,
        status: true,
        created_at: true,
      },
    });

    if (!city) {
      throw new NotFoundException('Город не найден');
    }

    return {
      id: city?.id,
      name: city[`name_${lan}`],
      status: city?.status,
      created_at: city?.created_at,
    };
  }

  async findOneAdmin(id: number) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      select: {
        id: true,
        name_ru: true,
        name_en: true,
        status: true,
        created_at: true,
      },
    });

    if (!city) {
      throw new NotFoundException('Город не найден');
    }

    return city;
  }

  async create(data: CreateCityDto) {
    const region = await this.prisma.city.findUnique({
      where: {
        id: data.region_id,
      },
    });

    if (!region) {
      throw new NotFoundException('Регион не найден');
    }

    await this.prisma.city.create({
      data: {
        name_ru: data.name_ru,
        name_en: data.name_en,
        region_id: data.region_id,
        status: data.status,
      },
    });

    return {
      status: HttpStatus.CREATED,
      message: 'Город успешно создан',
    };
  }

  async update(id: number, data: UpdateCityDto) {
    const city = await this.prisma.city.findUnique({
      where: {
        id: id,
      },
    });

    if (!city) {
      throw new NotFoundException('Город не найден');
    }

    if (data.region_id) {
      const region = await this.prisma.city.findUnique({
        where: {
          id: data.region_id,
        },
      });

      if (!region) {
        throw new NotFoundException('Регион не найден');
      }
    }

    await this.prisma.city.update({
      where: {
        id: id,
      },
      data: {
        name_ru: data.name_ru ?? city.name_ru,
        name_en: data.name_en ?? city.name_en,
        status: data.status ?? city.status,
        region_id: data.region_id ?? city.region_id,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Город успешно обновлен',
    };
  }

  async remove(id: number) {
    const city = await this.prisma.city.findUnique({
      where: {
        id: id,
      },
    });

    if (!city) {
      throw new NotFoundException('Город не найден');
    }

    await this.prisma.city.delete({
      where: {
        id: id,
      },
    });
  }
}
