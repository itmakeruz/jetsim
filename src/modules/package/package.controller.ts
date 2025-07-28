import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto, UpdatePackageDto, GetPackageDto } from './dto';
import { ApiOperation } from '@nestjs/swagger';
import { ParamId } from '@enums';

@Controller('package')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @ApiOperation({ summary: 'Get all packages admin', description: 'Get all packages admin' })
  @Get()
  async findAll(@Query() query: GetPackageDto) {
    return this.packageService.findAll(query);
  }

  @ApiOperation({ summary: 'Get package admin', description: 'Get package admin' })
  @Get(':id')
  async findOne(@Param() param: ParamId) {
    return this.packageService.findOne(param.id);
  }

  @ApiOperation({ summary: 'Create package admin', description: 'Create package admin' })
  @Post()
  async create(@Body() data: CreatePackageDto) {
    return this.packageService.create(data);
  }

  @ApiOperation({ summary: 'Update package admin', description: 'Update package admin' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePackageDto: UpdatePackageDto) {
    return this.packageService.update(+id, updatePackageDto);
  }

  @ApiOperation({ summary: 'Delete package admin', description: 'Delete package admin' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.packageService.remove(+id);
  }
}
