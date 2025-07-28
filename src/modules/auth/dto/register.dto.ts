import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ type: String, required: true, description: 'Name', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ type: String, required: true, description: 'Password', example: '123456' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
