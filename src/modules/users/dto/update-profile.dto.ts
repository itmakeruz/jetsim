import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ type: String, required: false, example: 'Falonchi' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: String, required: false, example: '+78945613133132' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiProperty({ type: String, required: false, example: 'Metro Peter' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ type: String, required: false, example: 'About me' })
  @IsOptional()
  @IsString()
  about?: string;

  @ApiProperty({
    description: 'User Progile Image',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  image: string;
}
