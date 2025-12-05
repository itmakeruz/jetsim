import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
}
