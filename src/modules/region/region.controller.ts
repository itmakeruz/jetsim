import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { RegionService } from './region.service';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { ParamId } from '@enums';

@Controller('region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}
  @Get()
  findAll(@Query() query: GetRegionDto) {
    return this.regionService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() param: ParamId) {
    return this.regionService.findOne(param.id);
  }

  @Post()
  create(@Body() createRegionDto: CreateRegionDto) {
    return this.regionService.create(createRegionDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto) {
    return this.regionService.update(+id, updateRegionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.regionService.remove(+id);
  }
}
