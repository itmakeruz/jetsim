import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTariffDto {
  @ApiProperty({ type: String, required: false, example: 'Название тарифа' })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Tariff name' })
  @IsOptional()
  @IsString()
  name_en: string;

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

  @ApiProperty({ type: Number, required: false, example: 1 })
  @IsOptional()
  @IsNumber()
  region_id: number;

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
}
