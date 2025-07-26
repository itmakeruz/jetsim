import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

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
}
