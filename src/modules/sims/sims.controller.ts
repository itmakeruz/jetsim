import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SimsService } from './sims.service';
import { DeviceHeadersDto, ParamId } from '@enums';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { AuthGuard } from '@nestjs/passport';
import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';

@Controller('sims')
export class SimsController {
  constructor(private readonly simsService: SimsService) {}

  @ApiOperation({ summary: 'Get all sims' })
  @Get()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findAll(@Query() query: any) {
    return this.simsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get all sims static' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('static')
  async findAllStaticSims(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.simsService.staticSims(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get all sims active working' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('active')
  async findAllActiveStaticSims(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.simsService.getActiveSimsStatic(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get all sims already activated also no actiive' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('activated')
  async findAllActivatedStaticSims(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.simsService.activatedStaticSims(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get all sims' })
  @Get('status')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findAllStatuses() {
    return this.simsService.checkSimStatusOnPartnerSide();
  }

  @ApiOperation({ summary: 'Get all sims' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('usage')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async getUsage(@Req() request: IRequest) {
    return this.simsService.getUsage(request.user.id);
  }

  @ApiOperation({ summary: 'Get sim by id' })
  @Get(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findOne(@Param() param: ParamId) {
    return this.simsService.findOne(param.id);
  }
}
