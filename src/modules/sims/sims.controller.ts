import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { SimsService } from './sims.service';
import { DeviceHeadersDto, ParamId } from '@enums';
import { ApiOperation } from '@nestjs/swagger';
import { IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';

@Controller('sims')
export class SimsController {
  constructor(private readonly simsService: SimsService) {}

  @ApiOperation({ summary: 'Get all sims' })
  @Get()
  async findAll(@Query() query: any) {
    return this.simsService.findAll(query);
  }

  @ApiOperation({ summary: 'Get all sims static' })
  @Get('static')
  async findAllStaticSims(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.simsService.staticSims(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get all sims active working' })
  @Get('active')
  async findAllActiveStaticSims(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.simsService.getActiveSimsStatic(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get all sims already activated also no actiive' })
  @Get('activated')
  async findAllActivatedStaticSims(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.simsService.activatedStaticSims(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get all sims' })
  @Get('status')
  async findAllStatuses() {
    return this.simsService.checkSimStatusOnPartnerSide();
  }

  @ApiOperation({ summary: 'Get sim by id' })
  @Get(':id')
  async findOne(@Param() param: ParamId) {
    return this.simsService.findOne(param.id);
  }
}
