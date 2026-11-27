import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
@Injectable()
export class CustomerGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: any) {
    const principal = super.handleRequest(err,user,info,context) as any;
    if (principal?.type !== 'user') throw new UnauthorizedException();
    return principal;
  }
}
