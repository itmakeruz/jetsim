import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { HttpModule, TBank } from '@http';
import { OrderModule } from '../order';
import { OrderService } from '../order/order.service';
import { QrService } from '@helpers';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, WinstonLoggerService, TBank, OrderService, QrService],
  imports: [PrismaModule, HttpModule, OrderModule],
})
export class PaymentModule {}
