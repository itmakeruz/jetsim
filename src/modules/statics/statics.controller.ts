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
    return 'statics';
  }

  @Get('tariff-type/:id')
  async findOneTariffType(@Param() param: ParamId) {
    return 'statics';
  }

  @Post('tariff-type')
  async createTariffType(@Body() data: CreateTariffType) {
    return 'statics';
  }

  @Patch('tariff-type/:id')
  async updateTariffType(@Param() param: ParamId, @Body() data: UpdateTariffType) {
    return 'statics';
  }

  @Delete('tariff-type/:id')
  async deleteTariffType(@Param() param: ParamId) {
    return 'statics';
  }
}
