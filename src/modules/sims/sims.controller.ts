import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SimsService } from './sims.service';
import { ParamId } from '@enums';
import { ApiOperation } from '@nestjs/swagger';

@Controller('sims')
export class SimsController {
  constructor(private readonly simsService: SimsService) {}

  @ApiOperation({ summary: 'Get all sims' })
  @Get()
  async findAll(@Query() query: any) {
    return this.simsService.findAll(query);
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
