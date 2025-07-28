import { Module } from '@nestjs/common';
import { PackageService } from './package.service';
import { PackageController } from './package.controller';
import { PrismaModule } from '@modules';

@Module({
  controllers: [PackageController],
  providers: [PackageService],
  imports: [PrismaModule],
})
export class PackageModule {}
