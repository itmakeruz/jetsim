import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class Package {
  @ApiProperty({ type: Number, required: true, example: 100 })
  @IsNotEmpty()
  @IsNumber()
  sms_count: number;

  @ApiProperty({ type: Number, required: true, example: 100 })
  @IsNotEmpty()
  @IsNumber()
  minutes_count: number;

  @ApiProperty({ type: Number, required: true, example: 100 })
  @IsNotEmpty()
  @IsNumber()
  mb_count: number;

  @ApiProperty({ type: String, required: true, example: 'sku_id' })
  @IsNotEmpty()
  @IsString()
  sku_id: string;

  @ApiProperty({ type: String, required: true, example: 'status', enum: Status })
  @IsNotEmpty()
  @IsEnum(Status)
  status: Status;
}
export class CreateTariffDto {
  @ApiProperty({ type: String, required: true, example: 'Название тарифа' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Tariff name' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({ type: String, required: true, example: 'Описание тарифа' })
  @IsNotEmpty()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Tariff description' })
  @IsNotEmpty()
  @IsString()
  description_en: string;

  @ApiProperty({ type: String, required: false, enum: Status })
  @IsNotEmpty()
  @IsEnum(Status)
  status: Status;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsNumber()
  partner_id: number;

  @ApiProperty({ type: Array, required: true, example: [1, 2, 3, 4, 5] })
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  region_ids: number[];

  @ApiProperty({ type: Boolean, required: false, example: true, default: false })
  @IsOptional()
  @IsBoolean()
  is_popular: boolean;

  @ApiProperty({ type: Boolean, required: false, example: true, default: false })
  @IsOptional()
  @IsBoolean()
  is_4g: boolean;

  @ApiProperty({ type: Boolean, required: false, example: true, default: false })
  @IsOptional()
  @IsBoolean()
  is_5g: boolean;

  @ApiProperty({
    type: [Package],
    required: true,
    example: [{ sms_count: 100, minutes_count: 100, mb_count: 100, sku_id: 'sku_id', status: Status.ACTIVE }],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Package)
  packages: Package[];
}
