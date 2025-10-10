import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateStaffDto, UpdateStaffDto } from './dto';
import { prisma } from '@helpers';
import { PrismaService } from '@prisma';
import * as bcrypt from 'bcrypt';
import { Status } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const staffs = await prisma.staff.findMany();
    return {
      success: true,
      message: '',
      data: staffs,
    };
  }

  async findOne(id: number) {
    const staff = await prisma.staff.findUnique({
      where: {
        id: id,
      },
    });

    if (!staff) {
      throw new NotFoundException('');
    }

    return {
      success: true,
      message: '',
      data: staff,
    };
  }

  async create(data: CreateStaffDto) {
    const saltOrRounds = 10;
    const staffExists = await prisma.staff.findFirst({
      where: {
        login: data?.login,
      },
    });

    if (staffExists) {
      throw new ConflictException('Login already exists!');
    }

    await this.prisma.staff.create({
      data: {
        name: data?.name,
        login: data?.login,
        password: await bcrypt.hash(data.password, saltOrRounds),
        role: data?.role,
        status: data?.role as Status,
      },
    });

    return {
      success: true,
      message: '',
      data: null,
    };
  }

  async update(id: number, data: UpdateStaffDto) {
    const saltOrRounds = 10;
    const staff = await this.prisma.staff.findUnique({
      where: {
        id: id,
      },
    });

    if (!staff) {
      throw new NotFoundException('');
    }

    const hashedPassword = data?.password ? await bcrypt.hash(data.password, saltOrRounds) : staff?.password;

    await this.prisma.staff.update({
      where: {
        id: staff.id,
      },
      data: {
        name: data?.name ?? staff?.name,
        login: data?.login ?? staff?.login,
        password: hashedPassword,
        role: data?.role ?? staff?.role,
        status: (data?.role as Status) ?? (staff.role as Status),
      },
    });

    return {
      success: true,
      message: '',
      data: null,
    };
  }

  async remove(id: number) {
    const staff = await this.prisma.staff.findUnique({
      where: {
        id: id,
      },
    });

    if (!staff) {
      throw new NotFoundException('');
    }
    await this.prisma.staff.delete({
      where: {
        id: id,
      },
    });

    return {
      success: true,
      message: '',
      data: null,
    };
  }
}
