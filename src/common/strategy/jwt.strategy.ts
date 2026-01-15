import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUser } from '@interfaces';
import * as jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET } from '@config';
import { PrismaService } from '@prisma';
import { unauthorized_error } from '@constants';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_ACCESS_SECRET,
    });
  }
  async validate(payload: IUser) {
    const userExists = await this.prisma.user.findUnique({
      where: {
        id: payload.id,
      },
    });

    if (!userExists) {
      throw new UnauthorizedException(unauthorized_error['ru']);
    }
    return {
      id: userExists.id,
      email: userExists.email,
    };
  }

  verify(token: string): IUser | null {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET) as IUser;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
}
