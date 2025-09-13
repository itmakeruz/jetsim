import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportOperatorsDto, UpdateSupportOperatorsDto } from './dto';
import { ParamId } from '@enums';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.supportService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param() param: ParamId) {
    return this.supportService.findOne(param.id);
  }

  @Post()
  async create(@Body() data: CreateSupportOperatorsDto) {
    return this.supportService.create(data);
  }

  @Patch(':id')
  async update(@Param() param: ParamId, @Body() updateSupportDto: UpdateSupportOperatorsDto) {
    return this.supportService.update(param.id, updateSupportDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.supportService.remove(+id);
  }
}
