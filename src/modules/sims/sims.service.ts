import { paginate } from '@helpers';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';

@Injectable()
export class SimsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const sims = await paginate('sims', query);
    return sims;
  }

  async findOne(id: number) {
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: id,
      },
    });
    return sim;
  }
}
