import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { HttpModule, TBank } from '@http';
import { OrderModule } from '../order';
import { OrderService } from '../order/order.service';
import { QrService } from '@helpers';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';
import { CreateSimService } from '../order/create-sim/create-sim.service';

@Module({
  controllers: [PaymentController],
  providers: [
    PaymentService,
    WinstonLoggerService,
    TBank,
    OrderService,
    QrService,
    TelegramBotService,
    CreateSimService,
  ],
  imports: [PrismaModule, HttpModule, OrderModule],
})
export class PaymentModule {}
