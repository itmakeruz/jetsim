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

  @ApiOperation({ summary: 'Get tariff mobile', description: 'Get tariff mobile' })
  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.tariffService.findOne(param.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get tariff admin', description: 'Get tariff admin' })
  @Get('admin/:id')
  async findOneAdmin(@Param() param: ParamId) {
    return this.tariffService.findOneAdmin(param.id);
  }

  @ApiOperation({ summary: 'Create tariff', description: 'Create tariff' })
  @Post()
  async create(@Body() data: CreateTariffDto) {
    return this.tariffService.create(data);
  }

  @ApiOperation({ summary: 'Update tariff', description: 'Update tariff' })
  @Patch(':id')
  async update(@Param() param: ParamId, @Body() data: UpdateTariffDto) {
    return this.tariffService.update(param.id, data);
  }

  @ApiOperation({ summary: 'Delete tariff', description: 'Delete tariff' })
  @Delete(':id')
  async remove(@Param() param: ParamId) {
    return this.tariffService.remove(param.id);
  }
}
