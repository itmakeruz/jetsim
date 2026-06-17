import { Module } from '@nestjs/common';
import { PrismaModule } from '@prisma';
import { PromoCodeController } from './promocode.controller';
import { PromoCodeService } from './promocode.service';

@Module({
  imports: [PrismaModule],
  controllers: [PromoCodeController],
  providers: [PromoCodeService],
  exports: [PromoCodeService],
})
export class PromoCodeModule {}
