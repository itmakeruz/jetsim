import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TariffService } from './tariff.service';
import { CreateTariffDto, GetTarifftDto, UpdateTariffDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { ApiOperation } from '@nestjs/swagger';
import { HeadersValidation } from '@decorators';

@Controller('tariff')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @ApiOperation({ summary: 'Get all tariffs mobile', description: 'Get all tariffs mobile' })
  @Get()
  async findAll(@Query() query: GetTarifftDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.tariffService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all tariffs admin', description: 'Get all tariffs admin' })
  @Get('admin')
  async findAllAdmin(@Query() query: GetTarifftDto) {
    return this.tariffService.findAllAdmin(query);
  }

  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.tariffService.findOne(param.id, headers.lang);
  }

  @Get('admin/:id')
  async findOneAdmin(@Param() param: ParamId) {
    return this.tariffService.findOneAdmin(param.id);
  }

  @Post()
  create(@Body() data: CreateTariffDto) {
    return this.tariffService.create(data);
  }

  @Patch(':id')
  update(@Param() param: ParamId, @Body() data: UpdateTariffDto) {
    return this.tariffService.update(param.id, data);
  }

  @Delete(':id')
  remove(@Param() param: ParamId) {
    return this.tariffService.remove(param.id);
  }
}
