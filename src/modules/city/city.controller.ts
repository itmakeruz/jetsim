import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CityService } from './city.service';
import { CreateCityDto, GetCityDto, UpdateCityDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { HeadersValidation } from '@decorators';
import { ApiOperation } from '@nestjs/swagger';

@Controller('city')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @ApiOperation({ summary: 'Get all cities mobile', description: 'Get all cities mobile' })
  @Get()
  async findAll(@Query() query: GetCityDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.cityService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all cities admin', description: 'Get all cities admin' })
  @Get('admin')
  async findAllAdmin(@Query() query: GetCityDto) {
    return this.cityService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Get city mobile', description: 'Get city mobile' })
  @Get(':id')
  async findOne(@Param('id') id: string, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.cityService.findOne(+id, headers.lang);
  }

  @ApiOperation({ summary: 'Get city admin', description: 'Get city admin' })
  @Get('admin/:id')
  async findOneAdmin(@Param() param: ParamId) {
    return this.cityService.findOneAdmin(param.id);
  }

  @ApiOperation({ summary: 'Create city admin', description: 'Create city admin' })
  @Post()
  async create(@Body() createCityDto: CreateCityDto) {
    return this.cityService.create(createCityDto);
  }

  @ApiOperation({ summary: 'Update city admin', description: 'Update city admin' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateCityDto: UpdateCityDto) {
    return this.cityService.update(+id, updateCityDto);
  }

  @ApiOperation({ summary: 'Delete city admin', description: 'Delete city admin' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.cityService.remove(+id);
  }
}
