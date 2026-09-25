import { Module } from '@nestjs/common';
import { SimsService } from './sims.service';
import { SimsController } from './sims.controller';
import { PrismaModule } from '@prisma';
import { BillionConnectService, HttpModule, JoyTel } from '@http';
import { WinstonLoggerService } from '@logger';
import { QrService } from '@helpers';

@Module({
  controllers: [SimsController],
  providers: [SimsService, JoyTel, BillionConnectService, WinstonLoggerService, QrService],
  imports: [PrismaModule, HttpModule],
})
export class SimsModule {}
