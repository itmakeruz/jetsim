import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { HttpModule, TBank } from '@http';
import { OrderModule } from '../order';
import { LoggerModule } from 'src/logging/logger.module';
import { PromoCodeModule } from '../promocode';
import { OrderEventsModule } from 'src/modules/order-events/order-events.module';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, WinstonLoggerService, TBank],
  imports: [PrismaModule, HttpModule, OrderModule, LoggerModule, PromoCodeModule, OrderEventsModule],
})
export class PaymentModule {}
