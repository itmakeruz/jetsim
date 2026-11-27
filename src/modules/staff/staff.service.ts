import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateStaffDto, UpdateStaffDto } from './dto';
import { PrismaService } from '@prisma';
import * as bcrypt from 'bcrypt';
import { Status } from '@prisma/client';

@Injectable()
export class StaffService {
  private assertManager(actor: any) {
    if (actor?.type !== 'staff' || actor?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
  }
  private readonly publicFields = { id: true, name: true, login: true, role: true, status: true, created_at: true } as const;

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const staffs = await this.prisma.staff.findMany({ select: this.publicFields });
    return {
      success: true,
      message: '',
      data: staffs,
    };
  }

  async findOne(id: number) {
    const staff = await this.prisma.staff.findUnique({
      where: { id }, select: this.publicFields,
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

  async create(data: CreateStaffDto, actor?: any) {
    this.assertManager(actor);
    const saltOrRounds = 10;
    const staffExists = await this.prisma.staff.findFirst({
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
        status: data?.status as Status,
      },
    });

    return {
      success: true,
      message: '',
      data: null,
    };
  }

  async update(id: number, data: UpdateStaffDto, actor?: any) {
    this.assertManager(actor);
    const saltOrRounds = 10;
    const staff = await this.prisma.staff.findUnique({
      where: {
        id: id,
      },
    });

    if (!staff) {
      throw new NotFoundException('');
    }

    const hashedPassword = data?.password ? await bcrypt.hash(data.password, saltOrRounds) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78124901)`;
      const current = await tx.staff.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      if (current?.role === 'SUPER_ADMIN' && current.status === 'ACTIVE' &&
          ((data.role && data.role !== 'SUPER_ADMIN') || (data.status && data.status !== 'ACTIVE')) &&
          await tx.staff.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } }) <= 1) {
        throw new ConflictException('Cannot disable the last active superadmin');
      }
      await tx.staff.update({
      where: {
        id: staff.id,
      },
      data: {
        name: data?.name ?? current.name,
        login: data?.login ?? current.login,
        password: hashedPassword ?? current.password,
        role: data?.role ?? current.role,
        status: (data?.status as Status) ?? (current.status as Status),
      },
      });
    });

    return { success: true, message: '', data: null };
  }

  async remove(id: number, actor?: any) {
    this.assertManager(actor);
    const staff = await this.prisma.staff.findUnique({
      where: {
        id: id,
      },
    });

    if (!staff) {
      throw new NotFoundException('');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78124901)`;
      const current = await tx.staff.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      if (current?.role === 'SUPER_ADMIN' && current.status === 'ACTIVE' &&
          await tx.staff.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } }) <= 1) {
        throw new ConflictException('Cannot delete the last active superadmin');
      }
      await tx.staff.delete({
      where: {
        id: id,
      },
      });
    });

    return {
      success: true,
      message: '',
      data: null,
    };
  }
}
