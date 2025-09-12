import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@prisma';
import * as bcrypt from 'bcrypt';
import { RegisterDto, DeviceFcmTokenUpdateDto, LoginDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { RedisService, generateOtp, sendMailHelper, otpEmailTemplate } from '@helpers';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}
  async validate(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не существует!');
    }

    return {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      password: user?.password,
    };
  }

  async login(data: LoginDto) {
    const user = await this.validate(data.email);

    if (!user) {
      throw new NotFoundException('Логин неверный!');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Недействительные учетные данные!');
    }

    const accessToken = this.jwtService.sign({
      id: user?.id,
      email: user?.email,
    });

    return {
      access_token: accessToken,
    };
  }

  async register(data: RegisterDto) {
    const isExist = await this.prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });

    if (isExist) {
      throw new BadRequestException('Этот электронный адрес уже занят!');
    }

    await this.prisma.user.create({
      data: {
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
      },
    });

    await this.generateAndStoreOtp(data.email);

    return {
      status: HttpStatus.CREATED,
      message: 'Пользователь успешно создан! OTP отправлен на ваш email.',
    };
  }

  async verifyOtp(email: string, otp: string) {
    const key = `otp:${email}`;
    const storedOtp = await this.redisService.getOtp(key);

    if (!storedOtp) {
      return { valid: false, message: 'OTP не найден или истек срок действия!' };
    }

    const isValid = storedOtp === otp;

    if (!isValid) {
      throw new UnauthorizedException('Неверный OTP код');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        is_verified: true,
      },
    });

    await this.redisService.deleteOtp(key);
    return {
      valid: true,
      message: 'OTP успешно подтвержден!',
    };
  }

  async getMeUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        is_verified: true,
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Пользователь успешно получен!',
      data: user,
    };
  }

  async getMeStaff(id: number) {
    const staff = await this.prisma.staff.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        login: true,
        status: true,
        created_at: true,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Пользователь успешно получен!',
      data: staff,
    };
  }

  async deviceFcmTokenUpdate(userId: number, fcmToken: DeviceFcmTokenUpdateDto) {
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        fcm_token: fcmToken.fcm_token,
      },
    });

    return {
      status: HttpStatus.OK,
      message: 'Токен FCM успешно обновлен!!',
      data: null,
    };
  }

  async generateAndStoreOtp(
    email: string,
    ttl: number = 120, // 120 секунд = 2 минуты
  ): Promise<{ message: string }> {
    try {
      const otp = generateOtp(6);
      const key = `otp:${email}`;

      await this.redisService.setOtp(key, otp, ttl);

      const ttlMinutes = Math.floor(ttl / 60);
      const html = otpEmailTemplate(email, otp, ttlMinutes);

      await sendMailHelper(email, 'Ваш OTP код', `Ваш OTP код: ${otp}. Действителен ${ttlMinutes} минут.`, html);

      return {
        message: `OTP для ${email} успешно сгенерирован и отправлен на email!`,
      };
    } catch (error) {
      console.error('OTP generatsiya xatosi:', error);
      throw new InternalServerErrorException('Ошибка при генерации или отправке OTP');
    }
  }
}
