import { Module } from '@nestjs/common';
import { RegionGroupService } from './region_group.service';
import { RegionGroupController } from './region_group.controller';
import { PrismaModule } from '@prisma';

@Module({
  controllers: [RegionGroupController],
  providers: [RegionGroupService],
  imports: [PrismaModule],
})
export class RegionGroupModule {}
