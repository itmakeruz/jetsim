import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform } from 'class-transformer';
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
  image: string;

  @ApiProperty({ type: String, required: false, enum: Status })
  @IsOptional()
  @IsString()
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
  region_category: number[];
}
