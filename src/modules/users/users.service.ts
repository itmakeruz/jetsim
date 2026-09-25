import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateUserDto, GetUsersDto, UpdateProfileDto } from './dto';
import { PrismaService } from '@prisma';
import { FilePath, profile_image_deleted, user_not_found } from '@constants';
import { paginate } from '@helpers';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetUsersDto) {
    const search = query?.search?.trim();
    const where: Prisma.UserWhereInput = {};

    if (search) {
      const or: Prisma.UserWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search, mode: 'insensitive' } },
      ];

      // id числовой — ищем по нему только когда запрос действительно число
      const asNumber = Number(search);
      if (Number.isInteger(asNumber) && asNumber > 0) {
        or.push({ id: asNumber });
      }

      where.OR = or;
    }

    const id = query?.id?.trim();
    if (id) {
      const asNumber = Number(id);
      // Не число — совпадений быть не может. Отдаём пустой список,
      // а не 400: оператор просто увидит «ничего не найдено»
      where.id = Number.isInteger(asNumber) && asNumber > 0 ? asNumber : -1;
    }

    const name = query?.name?.trim();
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    const email = query?.email?.trim();
    if (email) {
      where.email = { contains: email, mode: 'insensitive' };
    }

    const phone = query?.phone_number?.trim();
    if (phone) {
      where.phone_number = { contains: phone, mode: 'insensitive' };
    }

    if (query?.is_verified !== undefined) {
      where.is_verified = query.is_verified;
    }

    const createdAt = this.buildCreatedAtFilter(query);
    if (createdAt) {
      where.created_at = createdAt;
    }

    const users = await paginate('user', {
      page: query?.page,
      size: query?.size,
      where,
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

  private buildCreatedAtFilter(query: GetUsersDto): Prisma.DateTimeFilter | null {
    if (!query?.date_from && !query?.date_to) {
      return null;
    }

    const createdAt: Prisma.DateTimeFilter = {};

    if (query.date_from) {
      createdAt.gte = new Date(`${query.date_from}T00:00:00.000+03:00`);
    }

    if (query.date_to) {
      createdAt.lte = new Date(`${query.date_to}T23:59:59.999+03:00`);
    }

    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw new BadRequestException('date_from должен быть не позже date_to');
    }

    return createdAt;
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

    if (user?.image) {
      const imagePath = path.join(process.cwd(), 'uploads', 'user_profile_image', user.image);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

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
