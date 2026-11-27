import { storePublicImage } from '../../security/image-upload';
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
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { RegionService } from './region.service';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { HeadersValidation, Roles } from '@decorators';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { AtGuard, RolesGuard } from '@guards';
import { UserRoles } from '@prisma/client';

@Controller('region')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @ApiOperation({ summary: 'Get all regions public', description: 'Get all regions public' })
  @Get()
  async findAll(@Query() query: GetRegionDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.regionService.findAll(query, headers.lang);
  }

  @ApiOperation({ summary: 'Get all plans of regions public', description: 'Get all plans of regions public' })
  @Get('plans')
  async findPlans(@Query('ids') ids: string, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.regionService.getRegionPlansByIds(ids, headers.lang);
  }

  @ApiOperation({ summary: 'Get all regions admin', description: 'Get all regions admin' })
  @Get('admin')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findAllAdmin(@Query() query: GetRegionDto) {
    return await this.regionService.findAllAdmin(query);
  }

  @ApiOperation({ summary: 'Get region by id public', description: 'Get region by id public' })
  @Get(':id')
  async findOne(@Param() param: ParamId, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.regionService.findOne(param.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get region by id admin', description: 'Get region by id admin' })
  @Get('admin/:id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findOneAdmin(@Param() param: ParamId) {
    return this.regionService.findOneAdmin(param.id);
  }

  @ApiOperation({ summary: 'Create region admin', description: 'Create region admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionDto })
  @Post()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'cover_image', maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024, files: 2 } },
    ),
  )
  async create(
    @Body() data: CreateRegionDto,
    @UploadedFiles() files: { image?: Express.Multer.File[]; cover_image?: Express.Multer.File[] },
  ) {
    if (files?.image?.[0]) files.image[0].filename = await storePublicImage(files.image[0], 'region_icons');
    if (files?.cover_image?.[0]) files.cover_image[0].filename = await storePublicImage(files.cover_image[0], 'region_icons');
    return this.regionService.create(data, files?.image?.[0]?.filename, files?.cover_image?.[0]?.filename);
  }

  @ApiOperation({ summary: 'Update region', description: 'Update region' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateRegionDto })
  @Patch(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'cover_image', maxCount: 1 },
      ],
      { limits: { fileSize: 8 * 1024 * 1024, files: 2 } },
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() updateRegionDto: UpdateRegionDto,
    @UploadedFiles() files: { image?: Express.Multer.File[]; cover_image?: Express.Multer.File[] },
  ) {
    if (files?.image?.[0]) files.image[0].filename = await storePublicImage(files.image[0], 'region_icons');
    if (files?.cover_image?.[0]) files.cover_image[0].filename = await storePublicImage(files.cover_image[0], 'region_icons');
    return this.regionService.update(
      +id,
      updateRegionDto,
      files?.image?.[0]?.filename,
      files?.cover_image?.[0]?.filename,
    );
  }

  @ApiOperation({ summary: 'Delete region', description: 'Delete region' })
  @Delete(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async remove(@Param('id') id: string) {
    return this.regionService.remove(+id);
  }
}
