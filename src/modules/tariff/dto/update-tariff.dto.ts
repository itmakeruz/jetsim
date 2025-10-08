import { ApiProperty } from '@nestjs/swagger';
import { TariffType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTariffDto {
  @ApiProperty({ type: String, required: false, example: 'Название тарифа' })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Tariff name' })
  @IsOptional()
  @IsString()
  name_en: string;

  @ApiProperty({ type: String, required: false, example: 'Название тарифа' })
  @IsOptional()
  @IsString()
  title_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Tariff name' })
  @IsOptional()
  @IsString()
  title_en: string;

  @ApiProperty({ type: String, required: false, example: 'Описание тарифа' })
  @IsOptional()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Tariff description' })
  @IsOptional()
  @IsString()
  description_en: string;

  @ApiProperty({ type: String, required: false, example: 'status' })
  @IsOptional()
  @IsString()
  status: string;

  @ApiProperty({ type: Number, required: false, example: 1 })
  @IsOptional()
  @IsNumber()
  partner_id: number;

  @ApiProperty({ type: Array, required: false, example: [1, 2, 3, 4, 5] })
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  region_ids: number[];

  @ApiProperty({ type: Boolean, required: false, example: true, description: 'gets existed value' })
  @IsOptional()
  @IsBoolean()
  is_popular: boolean;

  @ApiProperty({ type: Boolean, required: false, example: true, description: 'gets existed value' })
  @IsOptional()
  @IsBoolean()
  is_4g: boolean;

  @ApiProperty({ type: Boolean, required: false, example: true, description: 'gets existed value' })
  @IsOptional()
  @IsBoolean()
  is_5g: boolean;

  @ApiProperty({ type: Number, required: false, example: 10 })
  @IsOptional()
  @IsNumber()
  quantity_sms: number;

  @ApiProperty({ type: Number, required: false, example: 10 })
  @IsOptional()
  @IsNumber()
  quantity_minute;

  @ApiProperty({ type: Number, required: false, example: 10 })
  @IsOptional()
  @IsNumber()
  quantity_internet: number;

  @ApiProperty({ type: Number, required: false, example: 10 })
  @IsOptional()
  @IsNumber()
  validity_period: number;

  @ApiProperty({ type: Number, required: false, example: 1000 })
  @IsOptional()
  @IsNumber()
  price_arrival: number;

  @ApiProperty({ type: Number, required: false, example: 1000 })
  @IsOptional()
  @IsNumber()
  price_sell: number;

  @ApiProperty({ type: String, required: false, example: 'sku_id' })
  @IsOptional()
  @IsString()
  sku_id: string;

  @ApiProperty({ type: Number, required: false, example: 10 })
  @IsOptional()
  @IsNumber()
  cashback_percent: number;

  @ApiProperty({ type: String, required: false, example: 'TURBO', enum: TariffType })
  @IsOptional()
  @IsString()
  type: TariffType;
}
