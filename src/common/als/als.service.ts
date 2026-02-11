import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class AlsService {
  constructor(private readonly als: AsyncLocalStorage<Map<string, string>>) {}
}
