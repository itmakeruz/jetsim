import { AuthService } from './auth.service';
import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { LoginDto, RegisterDto, ConfirmEmailDto, DeviceFcmTokenUpdateDto } from './dto';
import { ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IRequest } from '@interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register public', description: 'Register public' })
  @Post('register')
  async register(data: RegisterDto) {
    return await this.authService.register(data);
  }

  @ApiOperation({ summary: 'Login public', description: 'Login public' })
  @Post('login')
  async login(data: LoginDto) {
    return await this.authService.login(data);
  }

  @ApiOperation({ summary: 'Get me public', description: 'Get me public' })
  @Get('me')
  async getMeUser(@Req() request: IRequest) {
    return await this.authService.getMeUser(request.user.id);
  }

  @ApiOperation({ summary: 'Update Fcm Token public', description: 'Update Fcm Token public' })
  @Patch('device/fcm-token')
  async updateDeviceFcmToken(@Req() request: IRequest, data: DeviceFcmTokenUpdateDto) {
    return await this.authService.deviceFcmTokenUpdate(request.user.id, data);
  }

  @ApiOperation({ summary: 'Get me admin', description: 'Get me admin' })
  @Get('me-staff')
  async getMeStaff(@Req() request: IRequest) {
    return await this.authService.getMeStaff(request.user.id);
  }
}
