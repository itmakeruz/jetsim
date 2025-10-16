import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UpdateProfileDto } from './dto';
import { PrismaService } from '@prisma';
import { FilePath, profile_image_deleted, user_not_found } from '@constants';
import { paginate } from '@helpers';
import * as path from 'path';
import * as fs from 'fs';

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
        phone_number: true,
        address: true,
        about: true,
        image: true,
        created_at: true,
      },
    });
    return {
      success: true,
      message: '',
      ...users,
      data: users.data?.map((user) => ({
        ...user,
        image: user?.image ? `${FilePath.USER_PROFILE_IMAGE}/${user?.image}` : null,
      })),
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        is_verified: true,
        phone_number: true,
        address: true,
        about: true,
        image: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException(user_not_found['ru']);
    }

    return {
      success: true,
      message: 'Пользователь успешно получен!',
      data: {
        ...user,
        image: `${FilePath.USER_PROFILE_IMAGE}/${user?.image}`,
      },
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

  async updateProfile(id: number, data: UpdateProfileDto, fileName: string, lan: string) {
    const userExists = await this.prisma.user?.findUnique({
      where: {
        id: id,
      },
    });

    if (!userExists) {
      throw new NotFoundException(user_not_found[lan]);
    }

    if (fileName && userExists?.image) {
      const imagePath = path.join(process.cwd(), 'uploads', 'user_profile_image', userExists.image);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        name: data?.name ?? userExists?.name,
        phone_number: data?.phone_number ?? userExists?.phone_number,
        address: data?.address ?? userExists?.address,
        about: data?.about ?? userExists?.about,
        image: fileName ?? userExists?.image,
      },
      select: {
        id: true,
        name: true,
        email: true,
        is_verified: true,
        phone_number: true,
        address: true,
        about: true,
        image: true,
        created_at: true,
      },
    });

    return {
      success: true,
      message: user_not_found[lan],
      data: {
        ...updatedUser,
        image: updatedUser?.image ? `${FilePath.USER_PROFILE_IMAGE}/${updatedUser?.image}` : null,
      },
    };
  }

  async removeProfile(id: number, lang: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        image: true,
      },
    });

    if (!user) {
      throw new NotFoundException(user_not_found['ru']);
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: user?.id,
      },
      data: {
        image: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        is_verified: true,
        phone_number: true,
        address: true,
        about: true,
        image: true,
        created_at: true,
      },
    });

    return {
      success: true,
      message: profile_image_deleted[lang],
      data: {
        ...updatedUser,
        image: updatedUser?.image ? `${FilePath.USER_PROFILE_IMAGE}/${updatedUser?.image}` : null,
      },
    };
  }
}
