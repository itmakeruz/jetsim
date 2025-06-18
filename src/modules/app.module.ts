import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@config';
import { AuthModule, RegionModule, BranchModule, PrismaModule, ServiceModule, TariffModule } from '@modules';
import { WinstonLoggerService } from '@logger';
import { LoggingInterceptor } from '@interceptors';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    AuthModule,
    RegionModule,
    BranchModule,
    TariffModule,
    PrismaModule,
    ServiceModule,
  ],
  controllers: [],
  providers: [WinstonLoggerService, LoggingInterceptor],
  exports: [WinstonLoggerService],
})
export class AppModule {}
