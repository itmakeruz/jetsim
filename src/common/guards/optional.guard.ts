import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, _: ExecutionContext) {
    // Agar token xato bo‘lsa ham, foydalanuvchi null bo‘lib o‘tsin
    if (err || info) {
      return null;
    }
    return user;
  }
}
