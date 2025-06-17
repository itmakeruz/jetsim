import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@config';
import { AuthModule, RegionModule, BranchModule, PrismaModule } from '@modules';
@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    AuthModule,
    RegionModule,
    BranchModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
