import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto, UpdateBranchDto, GetBranchtDto } from './dto';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetBranchtDto) {
    const branches = await paginate('branch', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name_uz: true,
        name_ru: true,
        name_en: true,
        region: {
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
      data: branches,
    };
  }

  async findOne(id: number) {
    const branch = await this.prisma.branch.findUnique({
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
        region: {
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

    if (!branch) {
      throw new NotFoundException('Филиал с таким идентификатором не найден!');
    }
    return {
      status: HttpStatus.OK,
      data: branch,
    };
  }

  async create(data: CreateBranchDto) {
    const region = await this.prisma.region.findUnique({
      where: {
        id: data.region_id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!region) {
      throw new NotFoundException('Регион с указанным идентификатором не найден!');
    }

    await this.prisma.branch.create({
      data: {
        name_uz: data.name_uz,
        name_ru: data.name_ru,
        name_en: data.name_en,
        region_id: data.region_id,
      },
    });

    return {
      status: HttpStatus.CREATED,
    };
  }

  async update(id: number, data: UpdateBranchDto) {
    const existBranch = await this.prisma.branch.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!existBranch) {
      throw new NotFoundException('Филиал с таким идентификатором не найден!');
    }

    await this.prisma.branch.update({
      where: {
        id: existBranch.id,
      },
      data: {
        name_uz: data.name_uz ?? existBranch.name_uz,
        name_ru: data.name_ru ?? existBranch.name_ru,
        name_en: data.name_en ?? existBranch.name_en,
        region_id: data.region_id ?? existBranch.region_id,
      },
    });

    return {
      status: HttpStatus.OK,
    };
  }

  async remove(id: number) {
    const branch = await this.prisma.branch.findUnique({
      where: {
        id: id,
        deleted_at: {
          equals: null,
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Филиал с таким идентификатором не найден!');
    }

    await this.prisma.branch.update({
      where: {
        id: branch.id,
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }
}
