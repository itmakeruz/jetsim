import { validate } from '@config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonLoggerService } from '@logger';
import { LoggingInterceptor } from '@interceptors';
import { ServeStaticModule } from '@nestjs/serve-static';
import {
  AuthModule,
  FaqsModule,
  JobsModule,
  SimsModule,
  OrderModule,
  UsersModule,
  StaffModule,
  RegionModule,
  PrismaModule,
  TariffModule,
  GatewayModule,
  PartnerModule,
  SupportModule,
  StaticsModule,
  DashboardModule,
  RegionGroupModule,
} from '@modules';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    FaqsModule,
    JobsModule,
    SimsModule,
    OrderModule,
    UsersModule,
    StaffModule,
    RegionModule,
    PrismaModule,
    TariffModule,
    GatewayModule,
    PartnerModule,
    SupportModule,
    StaticsModule,
    DashboardModule,
    RegionGroupModule,
  ],
  controllers: [],
  providers: [WinstonLoggerService, LoggingInterceptor],
  exports: [WinstonLoggerService],
})
export class AppModule {}
