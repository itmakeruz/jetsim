import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaModule } from '@prisma';
import { HttpModule, JoyTel } from '@http';
import { QrService } from '@helpers';
import { WinstonLoggerService } from '@logger';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';
import { CreateSimService } from './create-sim/create-sim.service';
import { OrderEventsModule } from 'src/modules/order-events/order-events.module';

@Module({
  imports: [PrismaModule, HttpModule, OrderEventsModule],
  controllers: [OrderController],
  providers: [OrderService, JoyTel, QrService, WinstonLoggerService, TelegramBotService, CreateSimService],
  exports: [OrderService],
})
export class OrderModule {}
