import { validate } from '@config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonLoggerService } from '@logger';
import { LoggingInterceptor } from '@interceptors';
import {
  AuthModule,
  RegionModule,
  PrismaModule,
  TariffModule,
  CityModule,
  PackageModule,
  JobsModule,
  OrderModule,
  GatewayModule,
  PartnerModule,
  UsersModule,
  SimsModule,
  SupportModule,
} from '@modules';
// import { PaymentModule } from './modules/payment/payment.module';
import { HttpModule } from '@http';

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
    CityModule,
    PackageModule,
    OrderModule,
    JobsModule,
    GatewayModule,
    PartnerModule,
    UsersModule,
    HttpModule,
    SimsModule,
    SupportModule,
    // PaymentModule,
  ],
  controllers: [],
  providers: [WinstonLoggerService, LoggingInterceptor],
  exports: [WinstonLoggerService],
})
export class AppModule {}
