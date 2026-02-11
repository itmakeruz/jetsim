import { Module } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { MyLogger } from './logger.service';
import { LoggerController } from './logger.controller';

const als = new AsyncLocalStorage<Map<string, string>>();

@Module({
  controllers: [LoggerController],
  providers: [
    {
      provide: AsyncLocalStorage,
      useValue: als,
    },
    MyLogger,
  ],
  exports: [MyLogger, AsyncLocalStorage],
})
export class LoggerModule {}
