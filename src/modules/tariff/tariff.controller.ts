import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TariffService } from './tariff.service';
import { CreateTariffDto, GetTarifftDto, UpdateTariffDto } from './dto';
import { ParamId } from '@enums';

@Controller('tariff')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @Get()
  async findAll(@Query() query: GetTarifftDto) {
    return this.tariffService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() param: ParamId) {
    return this.tariffService.findOne(param.id);
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
