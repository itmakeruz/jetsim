import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto, UpdateBranchDto, GetBranchtDto } from './dto';
import { ParamId } from '@enums';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  async findAll(@Query() query: GetBranchtDto) {
    return this.branchService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param() param: ParamId) {
    return this.branchService.findOne(param.id);
  }

  @Post()
  async create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchService.create(createBranchDto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    return this.branchService.update(+id, updateBranchDto);
  }

  @Delete(':id')
  async remove(@Param() param: ParamId) {
    return this.branchService.remove(param.id);
  }
}
