import { Global, Module } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AlsService } from './als.service';

@Global()
@Module({
  providers: [
    AlsService,
    {
      provide: AsyncLocalStorage,
      useValue: new AsyncLocalStorage(),
    },
  ],
  exports: [AsyncLocalStorage, AlsService],
})
export class AlsModule {}
