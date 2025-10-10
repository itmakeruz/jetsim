import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ type: String, required: true, description: 'Login', example: 'test' })
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty({ type: String, required: true, description: 'Password', example: '123456' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
