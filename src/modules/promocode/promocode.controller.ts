import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Status } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '@decorators';
import { RolesGuard } from '@guards';
import { IRequest } from '@interfaces';
import { PromoCodeService } from './promocode.service';
import {
  AgentPromoReportQueryDto,
  AdminPromoReportQueryDto,
  CreateAgentPromoCodeDto,
  CreatePromoCodeDto,
  FindPromoCodeDto,
  UpdatePromoCodeDto,
  UpdatePromoSettingsDto,
  ValidatePromoCodeDto,
} from './dto';

@Controller('promocode')
export class PromoCodeController {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  @ApiOperation({ summary: 'Validate promocode for current user basket' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('validate')
  validate(@Req() request: IRequest, @Body() data: ValidatePromoCodeDto) {
    return this.promoCodeService.validatePublic(request.user.id, data);
  }

  @ApiOperation({ summary: 'Get promocode global settings' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('settings')
  getSettings() {
    return this.promoCodeService.getSettings();
  }

  @ApiOperation({ summary: 'Update promocode global settings' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('settings')
  updateSettings(@Body() data: UpdatePromoSettingsDto) {
    return this.promoCodeService.updateSettings(data);
  }

  @ApiOperation({ summary: 'Get all promocodes for admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin')
  findAllAdmin(@Query() query: FindPromoCodeDto) {
    return this.promoCodeService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Create promocode as admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('admin')
  createAdmin(@Req() request: IRequest, @Body() data: CreatePromoCodeDto) {
    return this.promoCodeService.createAdmin(request.user.id, data);
  }

  @ApiOperation({ summary: 'Update promocode as admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('admin/:id')
  updateAdmin(@Param('id') id: string, @Body() data: UpdatePromoCodeDto) {
    return this.promoCodeService.updateAdmin(+id, data);
  }

  @ApiOperation({ summary: 'Change promocode status as admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('admin/:id/status')
  changeStatus(@Param('id') id: string, @Body('status') status: Status) {
    if (!Object.values(Status).includes(status)) {
      throw new BadRequestException('Invalid promocode status!');
    }
    return this.promoCodeService.changeStatus(+id, status);
  }

  @ApiOperation({ summary: 'Get promocode statistics for admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin/statistics')
  getAdminStatistics(@Query() query: AdminPromoReportQueryDto) {
    return this.promoCodeService.getAdminStatistics(query);
  }

  @ApiOperation({ summary: 'Export promocode admin report to Excel' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin/report/excel')
  async exportAdminReportExcel(@Query() query: AdminPromoReportQueryDto, @Res() res: Response) {
    const buffer = await this.promoCodeService.getAdminReportExcel(query);
    const filename = `admin_promocode_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get global promocode settings for current agent' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AGENT')
  @Get('my/settings')
  getMySettings() {
    return this.promoCodeService.getAgentSettings();
  }

  @ApiOperation({ summary: 'Get current agent promocode statistics' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AGENT')
  @Get('my/statistics')
  getMyStatistics(@Req() request: IRequest, @Query() query: AgentPromoReportQueryDto) {
    return this.promoCodeService.getAgentStatistics(request.user.id, query);
  }

  @ApiOperation({ summary: 'Export current agent promocode report to Excel' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AGENT')
  @Get('my/report/excel')
  async exportMyReportExcel(@Req() request: IRequest, @Query() query: AgentPromoReportQueryDto, @Res() res: Response) {
    const buffer = await this.promoCodeService.getAgentReportExcel(request.user.id, query);
    const filename = `agent_promocode_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get current agent promocodes' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AGENT')
  @Get('my')
  findMy(@Req() request: IRequest, @Query() query: FindPromoCodeDto) {
    return this.promoCodeService.findMy(request.user.id, query);
  }

  @ApiOperation({ summary: 'Create promocode as current agent' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AGENT')
  @Post('my')
  createMy(@Req() request: IRequest, @Body() data: CreateAgentPromoCodeDto) {
    return this.promoCodeService.createForAgent(request.user.id, data);
  }
}
