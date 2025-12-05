import { AuthService } from './auth.service';
import { Controller, Get, Post, Body, Patch, Req, UseGuards } from '@nestjs/common';
import {
  LoginDto,
  ConfirmEmailDto,
  DeviceFcmTokenUpdateDto,
  ChangePassword,
  ConfirmChangePasswordOtp,
  PrepareChangePasswordDto,
  AuthDto,
  ChangePasswordDto,
} from './dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto } from '@enums';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register public', description: 'Register public' })
  @Post('send-otp')
  async auth(@Body() data: AuthDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.authService.auth(data, headers.lang);
  }

  @ApiOperation({ summary: 'Login public', description: 'Login public' })
  @Post('login')
  async login(@Body() data: LoginDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.authService.login(data, headers.lang);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get me public', description: 'Get me public' })
  @Get('me')
  async getMeUser(@Req() request: IRequest) {
    return await this.authService.getMeUser(request.user.id);
  }

  @ApiOperation({ summary: 'Confirm email public', description: 'Confirm email public' })
  @Post('confirm-email')
  async confirmEmail(@Body() data: ConfirmEmailDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.authService.verifyOtp(data.email, data.confirm_code, headers.lang);
  }

  @ApiOperation({
    summary: 'Change Password get OTP confirm code for public',
    description: 'Change Password get OTP confirm code for public',
  })
  @Post('forgot-password/prepare')
  async changePassword(@Body() data: PrepareChangePasswordDto, @HeadersValidation() headers: DeviceHeadersDto) {
    return await this.authService.forgotPasswordPrepare(data, headers.lang);
  }

  @ApiOperation({
    summary: 'Confirm Otp code',
    description: 'Confirm Otp code',
  })
  @Post('forgot-password/confirm-otp')
  async forgotPasswordConfirmOtp(
    @Body() data: ConfirmChangePasswordOtp,
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return this.authService.forgotPasswordConfirmOtp(data, headers.lang);
  }

  @ApiOperation({
    summary: 'Confirm Otp code',
    description: 'Confirm Otp code',
  })
  @Post('forgot-password/change-password')
  async changeForgottenPassword(@Body() data: ChangePassword, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.authService.changeForgottenpassword(data, headers.lang);
  }

  @ApiOperation({ summary: 'Update Fcm Token public', description: 'Update Fcm Token public' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch('device/fcm-token')
  async updateDeviceFcmToken(@Req() request: IRequest, data: DeviceFcmTokenUpdateDto) {
    return await this.authService.deviceFcmTokenUpdate(request.user.id, data);
  }

  @ApiOperation({ summary: 'Get me admin', description: 'Get me admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me-staff')
  async getMeStaff(@Req() request: IRequest) {
    return await this.authService.getMeStaff(request.user.id);
  }

  @ApiOperation({ summary: 'Change password public', description: 'Change password public' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('change-password')
  async changePasswordUser(
    @Req() request: IRequest,
    @Body() data: ChangePasswordDto,
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return await this.authService.changePassword(request.user.id, data, headers.lang);
  }
}
