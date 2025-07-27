import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCityDto {
  @ApiProperty({ type: String, required: false, example: 'Ташкент' })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Tashkent' })
  @IsOptional()
  @IsString()
  name_en: string;

  @ApiProperty({ type: Number, required: false, example: 1 })
  @IsOptional()
  @IsNumber()
  region_id: number;

  @ApiProperty({ type: String, required: false, enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status: Status;
}
