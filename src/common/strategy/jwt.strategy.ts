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
    if (payload?.type === 'staff' || payload?.role) {
      const staffExists = await this.prisma.staff.findUnique({
        where: {
          id: payload.id,
        },
        select: {
          id: true,
          login: true,
          role: true,
          status: true,
        },
      });

      if (!staffExists || staffExists.status !== 'ACTIVE') {
        throw new UnauthorizedException(unauthorized_error['ru']);
      }

      const role = staffExists.role;

      return {
        id: staffExists.id,
        login: staffExists.login,
        type: 'staff',
        role,
        roles: role ? [role] : [],
      };
    }

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
      type: 'user',
      roles: ['USER'],
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
