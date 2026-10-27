import { UsageModule } from '../usage/usage.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { WinstonLoggerService } from '@logger';
import { PrismaModule } from '@prisma';
import { HttpModule } from '@http';
import { OrderModule } from '../order';
import { PromoCodeModule } from '../promocode';

@Module({
  imports: [UsageModule, ScheduleModule.forRoot(), PrismaModule, HttpModule, OrderModule, PromoCodeModule],
  providers: [JobsService, WinstonLoggerService],
  exports: [JobsService],
})
export class JobsModule {}
