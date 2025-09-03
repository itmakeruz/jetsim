import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@prisma';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JWT_ACCESS_EXPIRE_TIME, JWT_ACCESS_SECRET } from '@config';
import { JwtStrategy } from '@strategy';
import { RedisService } from '@helpers';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: JWT_ACCESS_SECRET,
        signOptions: { expiresIn: JWT_ACCESS_EXPIRE_TIME },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RedisService],
})
export class AuthModule {}
