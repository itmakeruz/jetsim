import { ApiOperation } from '@nestjs/swagger';
import { HeadersValidation } from '@decorators';
import { TariffService } from './tariff.service';
import { DeviceHeadersDto, ParamId, QueryStatus } from '@enums';
import { CreateTariffDto, GetTarifftDto, UpdateTariffDto } from './dto';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';

@Controller('tariff')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @ApiOperation({ summary: 'Get all tariffs public', description: 'Get all tariffs public' })
  @Get()
  async findAll(@Query() query: GetTarifftDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.tariffService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all tariffs admin', description: 'Get all tariffs admin' })
  @Get('admin')
  async findAllAdmin(@Query() query: GetTarifftDto) {
    return this.tariffService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Get tariff public', description: 'Get tariff public' })
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
  @Patch(':id/change-status')
  async changeStatusTariff(@Param() param: ParamId, @Query() query: QueryStatus) {
    return this.tariffService.changeStatusTariff(param.id, query.status);
  }

  @ApiOperation({ summary: 'Update tariff', description: 'Update tariff' })
  @Patch('package/:id/change-status')
  async changeStatusPackage(@Param() param: ParamId, @Query() query: QueryStatus) {
    return this.tariffService.changeStatusPackage(param.id, query.status);
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
