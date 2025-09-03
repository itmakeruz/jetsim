import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaModule } from '@prisma';
import { HttpModule, JoyTel } from '@http';
import { QrService } from '@helpers';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [OrderController],
  providers: [OrderService, JoyTel, QrService],
})
export class OrderModule {}
