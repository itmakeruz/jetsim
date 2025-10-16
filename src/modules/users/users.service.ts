import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UpdateProfileDto } from './dto';
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

  async updateProfile(id: number, data: UpdateProfileDto, lan: string) {
    // const userExists = await this.prisma.user?.findUnique({
    //   where: {
    //     id: id,
    //   },
    // });

    // if(!userExists) {
    //   throw new Nor
    // }
    await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        name: data?.name,
        phone_number: data?.phone_number,
        address: data?.address,
        about: data?.about,
      },
    });

    return {
      success: true,
      message: user_not_found[lan],
      data: null,
    };
  }
}
