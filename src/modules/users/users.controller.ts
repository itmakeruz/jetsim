import { Controller, Get, Patch, Param, Post, Body, Req, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { DeviceHeadersDto, ParamId } from '@enums';
import { UpdateProfileDto } from './dto';
import { IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'update profile', description: 'update profile' })
  @Post('update-profile')
  async updateProfile(
    @Req() request: IRequest,
    @Body() data: UpdateProfileDto,
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return this.usersService.updateProfile(request?.user?.id, data, headers?.lang);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id') id: string) {
    return this.usersService.changeStatus(+id);
  }
}
