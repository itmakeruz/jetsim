import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ResellerPrincipal } from '../guards/reseller-key.guard';

/** Компания из проверенного закупочного ключа — единственный источник company-контекста. */
export const CurrentReseller = createParamDecorator((_: unknown, ctx: ExecutionContext): ResellerPrincipal => {
  return ctx.switchToHttp().getRequest().reseller;
});
