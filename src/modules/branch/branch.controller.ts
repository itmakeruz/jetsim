import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto, UpdateBranchDto, GetBranchtDto } from './dto';
import { ParamId } from '@enums';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  findAll(@Query() query: GetBranchtDto) {
    return this.branchService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') param: ParamId) {
    return this.branchService.findOne(param.id);
  }

  @Post()
  create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchService.create(createBranchDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    return this.branchService.update(+id, updateBranchDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchService.remove(+id);
  }
}
