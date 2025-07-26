import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { RegionService } from './region.service';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { HeadersValidation } from '@decorators';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @ApiOperation({ summary: 'Get all regions mobile', description: 'Get all regions mobile' })
  @Get()
  async findAll(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.regionService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all regions admin', description: 'Get all regions admin' })
  @Get('admin')
  async findAllAdmin(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.regionService.findAllAdmin(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get region by id mobile', description: 'Get region by id mobile' })
  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.regionService.findOne(param.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get region by id admin', description: 'Get region by id admin' })
  @Get('admin/:id')
  async findOneAdmin(@Param() param: ParamId) {
    return this.regionService.findOneAdmin(param.id);
  }

  @ApiOperation({ summary: 'Create region admin', description: 'Create region admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionDto })
  @Post()
  async create(@Body() createRegionDto: CreateRegionDto) {
    return this.regionService.create(createRegionDto);
  }

  @ApiOperation({ summary: 'Update region', description: 'Update region' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateRegionDto })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto) {
    return this.regionService.update(+id, updateRegionDto);
  }

  @ApiOperation({ summary: 'Delete region', description: 'Delete region' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.regionService.remove(+id);
  }
}
