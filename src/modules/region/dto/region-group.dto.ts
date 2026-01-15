import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRegionGroupDto {
  @ApiProperty({ type: String, required: true, example: 'Avstraliya & Novaya Zelandiya' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Australia & New Zealand' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Group Image',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  image: string;

  @ApiProperty({ type: String, required: false, enum: Status, default: Status.ACTIVE })
  @IsOptional()
  @IsEnum(Status)
  status: Status;

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
  region_ids: number[];
}

export class UpdateRegionGroupDto {
  @ApiProperty({ type: String, required: false, example: 'Avstraliya & Novaya Zelandiya' })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Australia & New Zealand' })
  @IsOptional()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Group Image',
    example: 'icon.png',
    required: false,
    type: String,
    format: 'binary',
  })
  image: string;

  @ApiProperty({ type: String, required: false, enum: Status, default: Status.ACTIVE })
  @IsOptional()
  @IsEnum(Status)
  status: Status;

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
  region_ids: number[];
}
