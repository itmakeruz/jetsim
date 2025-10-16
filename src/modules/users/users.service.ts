import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto';
import { PrismaService } from '@prisma';
import { user_not_found } from '@constants';
import { paginate } from '@helpers';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  async findAll(query: any) {
    const users = await paginate('user', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      select: {
        id: true,
        name: true,
        email: true,
        is_verified: true,
        created_at: true,
      },
    });
    return {
      success: true,
      message: '',
      ...users,
      data: users.data,
    };
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
    return {
      success: true,
      message: '',
      data: user,
    };
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
