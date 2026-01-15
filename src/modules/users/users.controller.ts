import {
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Body,
  Req,
  UseGuards,
  Query,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DeviceHeadersDto } from '@enums';
import { UpdateProfileDto } from './dto';
import { IRequest } from '@interfaces';
import { HeadersValidation, Roles } from '@decorators';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { AtGuard, RolesGuard } from '@guards';
import { UserRoles } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ description: 'Get users' })
  @Get()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @ApiOperation({ summary: 'update profile', description: 'update profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateProfileDto })
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/user_profile_image',
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
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('update-profile')
  async updateProfile(
    @Req() request: IRequest,
    @Body() data: UpdateProfileDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(request?.user?.id, data, file?.filename, headers?.lang);
  }

  @ApiOperation({ summary: 'delete profile image', description: 'delete profile image' })
  @UseGuards(AuthGuard('jwt'))
  @Delete('delete-profile-image/:id')
  async removeProfile(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.usersService.removeProfile(request?.user?.id, headers.lang);
  }

  @ApiOperation({ description: 'Get user details' })
  @Get(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @ApiOperation({ description: 'Update user details' })
  @Patch(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async update(@Param('id') id: string) {
    return this.usersService.changeStatus(+id);
  }
}
