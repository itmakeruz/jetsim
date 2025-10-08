import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AuthDto {
  @ApiProperty({ type: String, required: true, description: 'Name', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;
}
