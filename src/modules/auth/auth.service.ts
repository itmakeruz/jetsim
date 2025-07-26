import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import * as bcrypt from 'bcrypt';

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
}
