import { Module } from '@nestjs/common';
import { PrismaModule } from '@prisma';
import { HttpModule } from '@http';
import { RedisService } from '../../common/helpers/redis.helper';
import { SkyBlueService } from '../../http/skyblue.gateway';
import { UsageService } from './usage.service';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [RedisService, SkyBlueService, UsageService],
  exports: [UsageService],
})
export class UsageModule {}
