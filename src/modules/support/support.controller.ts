import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportOperatorsDto, UpdateSupportOperatorsDto, GetUserInfosDto } from './dto';
import { ParamId } from '@enums';
import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findAll(@Query() query: any) {
    return this.supportService.findAll(query);
  }

  @Get()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async getUserOrders(@Body() data: GetUserInfosDto) {
    return this.supportService.ordersByUserId(data);
  }

  @Get(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findOne(@Param() param: ParamId) {
    return this.supportService.findOne(param.id);
  }

  @Post()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async create(@Body() data: CreateSupportOperatorsDto) {
    return this.supportService.create(data);
  }

  @Patch(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async update(@Param() param: ParamId, @Body() updateSupportDto: UpdateSupportOperatorsDto) {
    return this.supportService.update(param.id, updateSupportDto);
  }

  @Delete(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async remove(@Param('id') id: string) {
    return this.supportService.remove(+id);
  }
}
