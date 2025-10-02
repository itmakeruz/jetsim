import { Module } from '@nestjs/common';
import { StaticsService } from './statics.service';
import { StaticsController } from './statics.controller';

@Module({
  controllers: [StaticsController],
  providers: [StaticsService],
})
export class StaticsModule {}
