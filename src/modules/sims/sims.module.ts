import { Module } from '@nestjs/common';
import { SimsService } from './sims.service';
import { SimsController } from './sims.controller';
import { PrismaModule } from '@prisma';

@Module({
  controllers: [SimsController],
  providers: [SimsService],
  imports: [PrismaModule],
})
export class SimsModule {}
