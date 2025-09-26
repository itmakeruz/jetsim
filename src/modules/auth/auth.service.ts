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
import {
  RegisterDto,
  DeviceFcmTokenUpdateDto,
  LoginDto,
  PrepareChangePasswordDto,
  ConfirmChangePasswordOtp,
  ChangePassword,
  ChangePasswordDto,
} from './dto';
import { JwtService } from '@nestjs/jwt';
import { RedisService, generateOtp, sendMailHelper, otpEmailTemplate } from '@helpers';
import { register_error, change_password_not_equal, change_password_not_equal_new_password } from '@constants';
import { JWT_RESET_TOKEN, JWT_RESET_EXPIRE_TIME } from '@config';

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
      uuid: user?.id,
      email: user?.email,
    });

    return {
      access_token: accessToken,
    };
  }

  async register(data: RegisterDto, lang: string) {
    const isExist = await this.prisma.user.findFirst({
      where: {
        email: data.email,
      },
    });

    if (isExist) {
      throw new BadRequestException(register_error[lang]);
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

  async forgotPasswordPrepare(data: PrepareChangePasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: data.email,
      },
      select: {
        id: true,
        email: true,
        is_verified: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Этот адрес электронной почты не зарегистрирован!');
    }

    await this.generateAndStoreOtpForgotPassword(user.email);

    return {
      error: false,
      status: HttpStatus.CREATED,
      message: 'OTP отправлен на ваш email!',
    };
  }

  async forgotPasswordConfirmOtp(data: ConfirmChangePasswordOtp) {
    const key = `otp:forgot:${data.email}`;
    const storedOtp = await this.redisService.getOtp(key);

    if (!storedOtp) {
      return { valid: false, message: 'OTP не найден или истек срок действия!' };
    }

    const isValid = storedOtp === data.confirmation_code;

    if (!isValid) {
      throw new UnauthorizedException('Неверный OTP код');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: data.email,
      },
      select: {
        id: true,
        email: true,
      },
    });

    const resetToken = await this.jwtService.signAsync(
      { id: user.id, email: user.email },
      { secret: JWT_RESET_TOKEN, expiresIn: JWT_RESET_EXPIRE_TIME },
    );

    await this.redisService.deleteOtp(key);
    return {
      valid: true,
      message: 'OTP успешно подтвержден!',
      data: {
        reset_token: resetToken,
      },
    };
  }

  async changeForgottenpassword(data: ChangePassword) {
    if (data.new_password !== data.confirm_password) {
      throw new BadRequestException('Пароли не совпадают!');
    }

    let payload;
    try {
      payload = await this.jwtService.verifyAsync(data.reset_token, {
        secret: JWT_RESET_TOKEN,
      });
    } catch (error) {
      throw new UnauthorizedException('Недействительный или просроченный токен сброса!');
    }

    await this.prisma.user.update({
      where: {
        id: payload.id,
      },
      data: {
        password: await bcrypt.hash(data.new_password, 10),
      },
    });

    return {
      error: false,
      status: HttpStatus.OK,
    };
  }

  async changePassword(userId: number, data: ChangePasswordDto, lang: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException();
    }

    if (user.password !== (await bcrypt.hash(data.current_password, 10))) {
      throw new BadRequestException(change_password_not_equal[lang]);
    }

    if (data.new_password !== data.confirm_password) {
      throw new BadRequestException(change_password_not_equal_new_password[lang]);
    }

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: await bcrypt.hash(data.new_password, 10),
      },
    });

    return {
      error: false,
      status: HttpStatus.OK,
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

  async generateAndStoreOtpForgotPassword(
    email: string,
    ttl: number = 120, // 120 секунд = 2 минуты
  ): Promise<{ message: string; error: boolean }> {
    try {
      const otp = generateOtp(6);
      const key = `otp:forgot:${email}`;

      await this.redisService.setOtp(key, otp, ttl);

      const ttlMinutes = Math.floor(ttl / 60);
      const html = otpEmailTemplate(email, otp, ttlMinutes);

      await sendMailHelper(
        email,
        'Ваш OTP код для изменить пароля',
        `Ваш OTP код: ${otp}. Действителен ${ttlMinutes} минут.`,
        html,
      );

      return {
        error: false,
        message: `OTP для ${email} успешно сгенерирован и отправлен на email!`,
      };
    } catch (error) {
      console.error('OTP generatsiya xatosi:', error);
      throw new InternalServerErrorException('Ошибка при генерации или отправке OTP');
    }
  }
}
