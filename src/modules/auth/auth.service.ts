import { BadRequestException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import * as bcrypt from 'bcrypt';
import { RegisterDto, DeviceFcmTokenUpdateDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  async validate(login: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: login,
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
      login: user?.email,
      name: user?.name,
      password: user?.password,
    };
  }

  async login(data: any) {
    const user = await this.validate(data.login);

    if (!user) {
      throw new NotFoundException('Логин неверный!');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Недействительные учетные данные!');
    }
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

    return {
      status: HttpStatus.CREATED,
      message: 'Пользователь успешно создан!',
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
}
