import { unauthorized_error } from '@constants';
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenExpiredError } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [context.getHandler(), context.getClass()]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      if (info instanceof TokenExpiredError) {
        throw new UnauthorizedException(unauthorized_error['ru']);
      }

      throw new UnauthorizedException(unauthorized_error['ru']);
    }

    return user;
  }
}
