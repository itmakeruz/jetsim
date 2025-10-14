import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { StaticsService } from './statics.service';
import { CreateTariffType, UpdateTariffType } from './dto';
import { ParamId } from '@enums';

@Controller('statics')
export class StaticsController {
  constructor(private readonly staticsService: StaticsService) {}

  /**
   * Tariff Type statics
   */
  @Get('tariff-type')
  async findAllTariffType() {
    return this.staticsService.findAllTariffTypes();
  }

  @Get('tariff-type/:id')
  async findOneTariffType(@Param() param: ParamId) {
    return this.staticsService.findOneTariffTypes(param.id);
  }

  @Post('tariff-type')
  async createTariffType(@Body() data: CreateTariffType) {
    return this.staticsService.createTariffType(data);
  }

  @Patch('tariff-type/:id')
  async updateTariffType(@Param() param: ParamId, @Body() data: UpdateTariffType) {
    return this.staticsService.updateTariffType(param.id, data);
  }

  @Delete('tariff-type/:id')
  async deleteTariffType(@Param() param: ParamId) {
    return this.staticsService.deleteTariffType(param.id);
  }
}
