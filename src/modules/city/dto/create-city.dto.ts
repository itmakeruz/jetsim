import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCityDto {
  @ApiProperty({ type: String, required: true, example: 'Ташкент' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Tashkent' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsNumber()
  region_id: number;

  @ApiProperty({ type: String, required: false, enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status: Status;
}
