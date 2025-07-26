import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRegionDto {
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Flag Image',
    example: 'icon.png',
    required: false,
    type: String,
    format: 'binary',
  })
  icon: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  status: Status;
}
