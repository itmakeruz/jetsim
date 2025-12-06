import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { RegionGroupService } from './region_group.service';
import { CreateRegionGroupDto, UpdateRegionGroupDto } from './dto';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { GetRegionDto } from '../region/dto';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto, ParamId } from '@enums';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';

@Controller('region-group')
export class RegionGroupController {
  constructor(private readonly regionGroupService: RegionGroupService) {}

  @ApiOperation({ summary: 'Get all region groups', description: 'Get all region groups' })
  @Get()
  async getRegionGroups(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.regionGroupService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all region groups admin', description: 'Get all region groups admin' })
  @Get('admin')
  async getRegionGroupsAdmin(@Query() query: GetRegionDto) {
    return this.regionGroupService.findRegionGroupsAdmin(query);
  }

  @ApiOperation({ summary: 'Get all plans of regions public', description: 'Get all plans of regions public' })
  @Get('plans/:id')
  async findPlans(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.regionGroupService.getRegionGroupPlans(param.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get region group by id admin', description: 'Get region group by id admin' })
  @Get('admin/:id')
  async getRegionGroupByIdAdmin(@Param('id') id: string) {
    return this.regionGroupService.findRegionOneRegionGroup(+id);
  }

  @ApiOperation({ summary: 'Create region group', description: 'Create region group' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionGroupDto })
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/region_group_icons',
        filename: (req, file, cb) => {
          const name = file.originalname.replace(/\s+/g, '');
          const uniqueName = uuidv4() + '-' + name;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async createRegionGroup(@Body() data: CreateRegionGroupDto, @UploadedFile() file: Express.Multer.File) {
    return this.regionGroupService.createRegionGroup(data, file?.filename);
  }

  @ApiOperation({ summary: 'Create region group', description: 'Create region group' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionGroupDto })
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/region_group_icons',
        filename: (req, file, cb) => {
          const name = file.originalname.replace(/\s+/g, '');
          const uniqueName = uuidv4() + '-' + name;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async updateRegionGroup(
    @Param('id') id: string,
    @Body() data: UpdateRegionGroupDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.regionGroupService.updateRegionGroup(+id, data, file?.filename);
  }

  @ApiOperation({ summary: 'Delete region group', description: 'Delete region group' })
  @Delete(':id')
  async deleteRegionGroup(@Param('id') id: string) {
    return this.regionGroupService.removeRegionGroup(+id);
  }
}
