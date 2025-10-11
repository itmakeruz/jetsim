import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRegionCategoryDto {
  @ApiProperty({ type: String, required: true, example: 'Америка' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'USA' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({
    type: [Number],
    required: false,
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(Number);
      } catch {
        return value.split(',').map((v) => Number(v.trim()));
      }
    }
    return Array.isArray(value) ? value.map(Number) : [];
  })
  regions: number[];

  @ApiProperty({
    description: 'Region Category icon',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  icon: string;
}

export class UpdateRegionCategoryDto {
  @ApiProperty({ type: String, required: false, example: 'Америка' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'USA' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Category icon',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  icon: string;

  @ApiProperty({
    type: [Number],
    required: false,
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(Number);
      } catch {
        return value.split(',').map((v) => Number(v.trim()));
      }
    }
    return Array.isArray(value) ? value.map(Number) : [];
  })
  regions: number[];
}
