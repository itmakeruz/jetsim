import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { WinstonLoggerService } from '@logger';
import { PrismaModule } from '@prisma';
import { HttpModule } from '@http';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, HttpModule],
  providers: [JobsService, WinstonLoggerService],
  exports: [JobsService],
})
export class JobsModule {}
