import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ConfirmEmailDto {
  @ApiProperty({ type: String, required: true, description: 'Name', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ type: String, required: true, description: 'Confirm Code', example: '123456' })
  @IsNotEmpty()
  @IsString()
  confirm_code: string;
}
