import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class AlsGuard implements CanActivate {
  constructor(private readonly als: AsyncLocalStorage<Map<string, string>>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let args = context.getArgs()[0];
    let getclass = context.getClass();
    let store = this.als.getStore();
    if (!store) return true;

    store.set('path', args.path);
    store.set('body', args.body);
    store.set('params', args.params);
    store.set('query', args.query);
    store.set('method', args.method);
    store.set('route', args.route?.path);
    store.set('class_controller', getclass.name);

    return true;
  }
}
