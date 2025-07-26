import { validate } from '@config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonLoggerService } from '@logger';
import { LoggingInterceptor } from '@interceptors';
import { AuthModule, RegionModule, PrismaModule, ServiceModule, TariffModule, CityModule } from '@modules';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    AuthModule,
    RegionModule,
    TariffModule,
    PrismaModule,
    ServiceModule,
    CityModule,
  ],
  controllers: [],
  providers: [WinstonLoggerService, LoggingInterceptor],
  exports: [WinstonLoggerService],
})
export class AppModule {}
