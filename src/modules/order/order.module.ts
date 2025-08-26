import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaModule } from '@prisma';
import { HttpModule, JoyTel, BillionConnectService } from '@http';
import { GatewayGateway, GatewayModule } from '@modules';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
