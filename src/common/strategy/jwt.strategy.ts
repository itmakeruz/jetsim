import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUser } from '@interfaces';
import * as jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET } from '@config';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_ACCESS_SECRET,
    });
  }
  validate(payload: IUser): IUser {
    return {
      id: +payload.id,
      username: payload.username,
      role: payload.role,
    };
  }

  verify(token: string): IUser | null {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET) as IUser;
    } catch (err) {
      return null;
    }
  }
}
