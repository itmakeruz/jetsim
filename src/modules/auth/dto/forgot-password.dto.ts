import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PrepareChangePasswordDto {
  @ApiProperty({ type: String, required: true, example: 'nimadirda@gmail.com' })
  @IsNotEmpty()
  @IsString()
  email: string;
}

export class ConfirmChangePasswordOtp {
  @ApiProperty({ type: String, required: true, example: 'nimadirda@gmail.com' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ type: String, required: true, example: '123456' })
  @IsNotEmpty()
  @IsString()
  confirmation_code: string;
}

export class ChangePassword {
  @ApiProperty({ type: String, required: true, example: 'nimadirda123' })
  @IsNotEmpty()
  @IsString()
  new_password: string;

  @ApiProperty({ type: String, required: true, example: 'nimadirda123' })
  @IsNotEmpty()
  @IsString()
  confirm_password: string;

  @ApiProperty({ type: String, required: true, example: 'reset-token' })
  @IsNotEmpty()
  @IsString()
  reset_token: string;
}
