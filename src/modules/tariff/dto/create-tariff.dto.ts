import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty({ type: String, required: false, example: 'status' })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsNumber()
  partner_id: number;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsNumber()
  region_id: number;

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
}
