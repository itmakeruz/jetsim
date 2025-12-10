import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, WinstonLoggerService],
  imports: [PrismaModule],
})
export class PaymentModule {}
