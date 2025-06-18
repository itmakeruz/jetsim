import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { PrismaService } from '@prisma';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return `This action returns all branch`;
  }

  async findOne(id: number) {
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
