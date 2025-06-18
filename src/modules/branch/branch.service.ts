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
            name_eng: true,
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
            name_eng: true,
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

  create(createBranchDto: CreateBranchDto) {
    return 'This action adds a new branch';
  }

  update(id: number, updateBranchDto: UpdateBranchDto) {
    return `This action updates a #${id} branch`;
  }

  remove(id: number) {
    return `This action removes a #${id} branch`;
  }
}
