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
  UseGuards,
} from '@nestjs/common';
import { RegionService } from './region.service';
import { CreateRegionDto, GetRegionDto, UpdateRegionDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { HeadersValidation, Roles } from '@decorators';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
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
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async findOneAdmin(@Param() param: ParamId) {
    return this.regionService.findOneAdmin(param.id);
  }

  @ApiOperation({ summary: 'Create region admin', description: 'Create region admin' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateRegionDto })
  @Post()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
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
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
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
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN)
  async remove(@Param('id') id: string) {
    return this.regionService.remove(+id);
  }
}
