import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SimsService } from './sims.service';
import { DeviceHeadersDto, ParamId } from '@enums';
import { FindAllSimsDto } from './dto';
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
  @ApiBearerAuth()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findAll(@Query() query: FindAllSimsDto) {
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
  @ApiBearerAuth()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findAllStatuses() {
    return this.simsService.checkSimStatusOnPartnerSide();
  }

  @ApiOperation({ summary: 'Get all sims' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('usage')
  async getUsage(@Req() request: IRequest) {
    return this.simsService.getUsage(request.user.id);
  }

  @ApiOperation({ summary: 'QR-код eSIM в PNG; генерируется на лету, если файл не сохранился' })
  @Get(':id/qr')
  @ApiBearerAuth()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async getQrCode(@Param() param: ParamId, @Res() res: Response) {
    const buffer = await this.simsService.getQrCode(param.id);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get sim by id' })
  @Get(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findOne(@Param() param: ParamId) {
    return this.simsService.findOne(param.id);
  }
}
