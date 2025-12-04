import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { RegionService } from './region.service';
import { CreateRegionDto, CreateRegionGroupDto, GetRegionDto, UpdateRegionDto, UpdateRegionGroupDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { HeadersValidation } from '@decorators';
import { ApiBody, ApiConsumes, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';

@Controller('region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @ApiOperation({ summary: 'Get all regions public', description: 'Get all regions public' })
  @Get()
  async findAll(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.regionService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all regions admin', description: 'Get all regions admin' })
  @Get('admin')
  async findAllAdmin(@Query() query: GetRegionDto) {
    return await this.regionService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Get all region groups', description: 'Get all region groups' })
  @Get('region-group')
  async getRegionGroups(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.regionService.findRegionGroups(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all region groups admin', description: 'Get all region groups admin' })
  @Get('region-group/admin')
  async getRegionGroupsAdmin(@Query() query: GetRegionDto) {
    return this.regionService.findRegionGroupsAdmin(query);
  }

  @ApiOperation({ summary: 'Get region by id public', description: 'Get region by id public' })
  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.regionService.findOne(param.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get region by id admin', description: 'Get region by id admin' })
  @Get('admin/:id')
  async findOneAdmin(@Param() param: ParamId) {
    return this.regionService.findOneAdmin(param.id);
  }

  @ApiOperation({ summary: 'Get region group by id admin', description: 'Get region group by id admin' })
  @Get('region-group/admin/:id')
  async getRegionGroupByIdAdmin(@Param('id') id: string) {
    return this.regionService.findRegionOneRegionGroup(+id);
  }

  @ApiOperation({ summary: 'Create region admin', description: 'Create region admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionDto })
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/region_icons',
        filename: (req, file, cb) => {
          if (!file) {
            throw new BadRequestException('Требуется изображение!');
          }
          const name = file.originalname.replace(/\s+/g, '');
          const uniqueName = uuidv4() + '-' + name;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async create(@Body() data: CreateRegionDto, @UploadedFile() file: Express.Multer.File) {
    return this.regionService.create(data, file?.filename);
  }

  @ApiOperation({ summary: 'Update region', description: 'Update region' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateRegionDto })
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/region_icons',
        filename: (req, file, cb) => {
          const name = file.originalname.replace(/\s+/g, '');
          const uniqueName = uuidv4() + '-' + name;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateRegionDto: UpdateRegionDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.regionService.update(+id, updateRegionDto, file?.filename);
  }

  @ApiOperation({ summary: 'Delete region', description: 'Delete region' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.regionService.remove(+id);
  }

  /**
   *
   *
   *
   * REGION GROUPS
   *
   */

  @ApiOperation({ summary: 'Create region group', description: 'Create region group' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionGroupDto })
  @Post('region-group')
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
    console.log(data);
    return this.regionService.createRegionGroup(data, file?.filename);
  }

  @ApiOperation({ summary: 'Create region group', description: 'Create region group' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionGroupDto })
  @Patch('region-group/:id')
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
    console.log(data);

    return this.regionService.updateRegionGroup(+id, data, file?.filename);
  }

  @ApiOperation({ summary: 'Delete region group', description: 'Delete region group' })
  @Delete('region-group/:id')
  async deleteRegionGroup(@Param('id') id: string) {
    return this.regionService.removeRegionGroup(+id);
  }
}
