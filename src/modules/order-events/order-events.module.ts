import { Module } from '@nestjs/common';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { OrderEventsService } from './order-events.service';

@Module({
  imports: [PrismaModule],
  providers: [OrderEventsService, WinstonLoggerService],
  exports: [OrderEventsService],
})
export class OrderEventsModule {}
