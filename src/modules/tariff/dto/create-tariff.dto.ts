import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTariffDto {
  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  description_uz: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  description_en: string;
}
