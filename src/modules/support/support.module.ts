import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { PrismaModule } from '@prisma';

@Module({
  controllers: [SupportController],
  providers: [SupportService],
  imports: [PrismaModule],
})
export class SupportModule {}
