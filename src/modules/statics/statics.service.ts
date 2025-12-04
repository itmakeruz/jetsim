import { statics_identification } from '@constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { CreateTariffType, UpdateTariffType } from './dto';

@Injectable()
export class StaticsService {
  constructor(private readonly prisma: PrismaService) {}
}
