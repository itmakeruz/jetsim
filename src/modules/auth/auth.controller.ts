import { AuthService } from './auth.service';
import { Controller, Get, Post, Body, Patch, Req } from '@nestjs/common';
import { LoginDto, RegisterDto, ConfirmEmailDto, DeviceFcmTokenUpdateDto } from './dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IRequest } from '@interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register public', description: 'Register public' })
  @Post('register')
  async register(@Body() data: RegisterDto) {
    return await this.authService.register(data);
  }

  @ApiOperation({ summary: 'Login public', description: 'Login public' })
  @Post('login')
  async login(@Body() data: LoginDto) {
    return await this.authService.login(data);
  }

  @ApiOperation({ summary: 'Get me public', description: 'Get me public' })
  @ApiBearerAuth('access_token')
  @Get('me')
  async getMeUser(@Req() request: IRequest) {
    return await this.authService.getMeUser(request.user.id);
  }

  @ApiOperation({ summary: 'Confirm email public', description: 'Confirm email public' })
  @Post('confirm-email')
  async confirmEmail(@Body() data: ConfirmEmailDto) {
    return await this.authService.verifyOtp(data.email, data.confirm_code);
  }

  @ApiOperation({ summary: 'Update Fcm Token public', description: 'Update Fcm Token public' })
  @ApiBearerAuth('access_token')
  @Patch('device/fcm-token')
  async updateDeviceFcmToken(@Req() request: IRequest, data: DeviceFcmTokenUpdateDto) {
    return await this.authService.deviceFcmTokenUpdate(request.user.id, data);
  }

  @ApiOperation({ summary: 'Get me admin', description: 'Get me admin' })
  @ApiBearerAuth('access_token')
  @Get('me-staff')
  async getMeStaff(@Req() request: IRequest) {
    return await this.authService.getMeStaff(request.user.id);
  }
}
