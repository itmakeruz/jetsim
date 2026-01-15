import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { CreatePartnerDto, UpdatePartnerDto, GetAllPartnerDto } from './dto';
import { ParamId } from '@enums';
import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';
import { ApiOperation } from '@nestjs/swagger';

@Controller('partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @ApiOperation({ description: 'Find All partners for sale ESIMS' })
  @Get()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  async findAll(@Query() query: GetAllPartnerDto) {
    return this.partnerService.findAll(query);
  }

  @ApiOperation({ description: 'Find One partner for sale ESIMS' })
  @Get(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  async findOne(@Param() param: ParamId) {
    return this.partnerService.findOne(param.id);
  }

  @ApiOperation({ description: 'Create partner for sale ESIMS' })
  @Post()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  async create(@Body() data: CreatePartnerDto) {
    return this.partnerService.create(data);
  }

  @ApiOperation({ description: 'Update partner for sale ESIMS' })
  @Patch(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  async update(@Param() param: ParamId, @Body() data: UpdatePartnerDto) {
    return this.partnerService.update(param.id, data);
  }

  @ApiOperation({ description: 'Delete partner for sale ESIMS' })
  @Delete(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  async remove(@Param() param: ParamId) {
    return this.partnerService.remove(param.id);
  }
}
