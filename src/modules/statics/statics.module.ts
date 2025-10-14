import { Module } from '@nestjs/common';
import { StaticsService } from './statics.service';
import { StaticsController } from './statics.controller';
import { PrismaModule } from '@prisma';

@Module({
  controllers: [StaticsController],
  providers: [StaticsService],
  imports: [PrismaModule],
})
export class StaticsModule {}
