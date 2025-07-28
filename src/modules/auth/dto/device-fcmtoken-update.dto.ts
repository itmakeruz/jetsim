import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeviceFcmTokenUpdateDto {
  @ApiProperty({ type: String, required: true, description: 'FCM Token', example: '123456' })
  @IsNotEmpty()
  @IsString()
  fcm_token: string;
}
