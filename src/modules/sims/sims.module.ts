import { Module } from '@nestjs/common';
import { SimsService } from './sims.service';
import { SimsController } from './sims.controller';
import { PrismaModule } from '@prisma';
import { HttpModule, JoyTel } from '@http';

@Module({
  controllers: [SimsController],
  providers: [SimsService, JoyTel],
  imports: [PrismaModule, HttpModule],
})
export class SimsModule {}
