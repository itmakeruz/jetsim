import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { CreatePartnerDto, UpdatePartnerDto, GetAllPartnerDto } from './dto';
import { ParamId } from '@enums';

@Controller('partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get()
  async findAll(@Query() query: GetAllPartnerDto) {
    return this.partnerService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() param: ParamId) {
    return this.partnerService.findOne(param.id);
  }

  @Post()
  create(@Body() data: CreatePartnerDto) {
    return this.partnerService.create(data);
  }

  @Patch(':id')
  update(@Param() param: ParamId, @Body() data: UpdatePartnerDto) {
    return this.partnerService.update(param.id, data);
  }

  @Delete(':id')
  remove(@Param() param: ParamId) {
    return this.partnerService.remove(param.id);
  }
}
