import { Status } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRegionDto {
  @ApiProperty({ type: String, required: true, example: 'Ташкент' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Tashkent' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Flag Image',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  image: string;

  @ApiProperty({ type: String, required: false, enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status: Status;

  @ApiProperty({ type: [Number], required: true, example: [1, 2] })
  @IsInt({ each: true })
  @Type(() => Number)
  region_category: number[];
}
