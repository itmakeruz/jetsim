import { validate } from '@config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonLoggerService } from '@logger';
import { AsyncLocalStorage } from 'async_hooks';
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
  PaymentModule,
  SupportModule,
  DashboardModule,
  RegionGroupModule,
  TransactionModule,
} from '@modules';
import { LoggerModule } from './logging/logger.module';
import * as path from 'path';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot(
      {
        rootPath: path.join(__dirname, '..', 'uploads'),
        serveRoot: '/uploads',
      },
      {
        rootPath: join(process.cwd(), 'public'),
        serveRoot: '/',
      },
      {
        rootPath: join(process.cwd(), 'logo_image'),
        serveRoot: '/logo_image',
      },
    ),
    AuthModule,
    FaqsModule,
    JobsModule,
    SimsModule,
    OrderModule,
    UsersModule,
    StaffModule,
    RegionModule,
    PrismaModule,
    PaymentModule,
    TariffModule,
    GatewayModule,
    PartnerModule,
    SupportModule,
    DashboardModule,
    RegionGroupModule,
    TransactionModule,
    LoggerModule,
  ],
  controllers: [],
  providers: [WinstonLoggerService, LoggingInterceptor],
  exports: [WinstonLoggerService],
})
export class AppModule {
  constructor(private readonly als: AsyncLocalStorage<Map<string, string>>) {}
}
