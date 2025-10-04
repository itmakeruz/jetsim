import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto';
import { PrismaService } from '@prisma';
import { user_not_found } from '@constants';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users;
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });

    if (!user) {
      throw new NotFoundException(user_not_found['ru']);
    }
    return user;
  }

  async changeStatus(id: number) {
    const user = await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        is_verified: true,
      },
    });

    if (!user) {
      throw new NotFoundException(user_not_found['ru']);
    }
    return user;
  }
}
