import { AuthService } from './auth.service';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LoginDto, RegisterDto, ConfirmEmailDto, DeviceFcmTokenUpdateDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
}
