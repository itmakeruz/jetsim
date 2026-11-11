import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

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
    description: 'ISO 3166-1 alpha-2 код страны (TR, US). Пустая строка — сбросить код (регион не страна)',
    example: 'TR',
    required: false,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^([A-Z]{2})?$/, { message: 'iso_code: два латинских символа по ISO 3166-1 alpha-2, например TR' })
  iso_code?: string;

  @ApiProperty({
    description: 'Region Flag Image',
    example: 'icon.png',
    required: false,
    type: String,
    format: 'binary',
  })
  image: string;

  @ApiProperty({
    description: 'Destination cover photo (JPEG, PNG, WebP)',
    required: false,
    type: String,
    format: 'binary',
  })
  @IsOptional()
  cover_image?: string;

  @ApiProperty({ description: 'Remove saved cover', required: false, enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  remove_cover?: string;

  @ApiProperty({ type: String, required: false, enum: Status })
  @IsOptional()
  @IsString()
  status: Status;
}
