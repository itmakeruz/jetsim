import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(+id);
  }

  @Post()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  create(@Req() req: any, @Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(createStaffDto, req.user);
  }

  @Patch(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  update(@Req() req: any, @Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
    return this.staffService.update(+id, updateStaffDto, req.user);
  }

  @Delete(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.staffService.remove(+id, req.user);
  }
}
