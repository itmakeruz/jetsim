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
import {
  CreateRegionCategoryDto,
  CreateRegionDto,
  GetRegionDto,
  UpdateRegionCategoryDto,
  UpdateRegionDto,
} from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { HeadersValidation } from '@decorators';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
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

  @ApiOperation({ summary: 'Get Region categories for public', description: 'Get Region categories for public' })
  @Get('category')
  async getRegionCategory(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.regionService.getRegionCategoryPublic(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get Region categories for admin', description: 'Get Region categories for admin' })
  @Get('admin/category')
  async getRegionCategoryAdmin(@Query() query: GetRegionDto) {
    return this.regionService.getRegionCategoryAdmin(query);
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
    console.log(data.region_category);

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
   * REGION CATEGORIES
   *
   */

  @ApiOperation({ summary: 'Create region category admin', description: 'Create region category admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionCategoryDto })
  @Post('category')
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: diskStorage({
        destination: './uploads/region_category_icons',
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
  async createRegionCategory(@Body() data: CreateRegionCategoryDto, @UploadedFile() file: Express.Multer.File) {
    return this.regionService.createRegionCategory(data, file?.filename);
  }

  @ApiOperation({ summary: 'Create region category admin', description: 'Create region category admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionCategoryDto })
  @Patch('category/:id')
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: diskStorage({
        destination: './uploads/region_category_icons',
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
  async updateRegionCategory(
    @Param() param: ParamId,
    @Body() data: UpdateRegionCategoryDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.regionService.updateRegionCategory(param.id, data, file?.filename);
  }
}
