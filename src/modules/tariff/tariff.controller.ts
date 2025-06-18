import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TariffService } from './tariff.service';
import { CreateTariffDto, UpdateTariffDto } from './dto';

@Controller('tariff')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @Get()
  findAll() {
    return this.tariffService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tariffService.findOne(+id);
  }

  @Post()
  create(@Body() data: CreateTariffDto) {
    return this.tariffService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateTariffDto) {
    return this.tariffService.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tariffService.remove(+id);
  }
}
