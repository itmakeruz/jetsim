import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { WinstonLoggerService } from '@logger';
import { PrismaModule } from '@prisma';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [JobsService, WinstonLoggerService],
  exports: [JobsService],
})
export class JobsModule {}
