import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceDto, GetServicetDto, UpdateServiceDto } from './dto';
import { ParamId } from '@enums';

@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  async findAll(@Query() query: GetServicetDto) {
    return this.serviceService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param() param: ParamId) {
    return this.serviceService.findOne(param.id);
  }

  @Post()
  async create(@Body() data: CreateServiceDto) {
    return this.serviceService.create(data);
  }

  @Patch(':id')
  async update(@Param() param: ParamId, @Body() data: UpdateServiceDto) {
    return this.serviceService.update(param.id, data);
  }

  @Delete(':id')
  async remove(@Param() param: ParamId) {
    return this.serviceService.remove(param.id);
  }
}
