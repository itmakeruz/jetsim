import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { HttpModule, TBank } from '@http';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, WinstonLoggerService, TBank],
  imports: [PrismaModule, HttpModule],
})
export class PaymentModule {}
