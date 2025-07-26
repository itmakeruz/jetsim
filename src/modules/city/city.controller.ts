import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CityService } from './city.service';
import { CreateCityDto, GetCityDto, UpdateCityDto } from './dto';
import { DeviceHeadersDto } from '@enums';
import { HeadersValidation } from '@decorators';

@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get()
  findAll(@Query() query: GetCityDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.cityService.findAll(query, headers.lang);
  }

  @Get('admin')
  findAllAdmin(@Query() query: GetCityDto) {
    return this.cityService.findAllAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.cityService.findOne(+id, headers.lang);
  }

  @Post()
  create(@Body() createCityDto: CreateCityDto) {
    return this.cityService.create(createCityDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCityDto: UpdateCityDto) {
    return this.cityService.update(+id, updateCityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cityService.remove(+id);
  }
}
