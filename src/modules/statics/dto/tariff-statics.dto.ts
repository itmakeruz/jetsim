import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTariffType {
  @ApiProperty({ type: String, required: true, example: 'TURBO' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'TURBO' })
  @IsNotEmpty()
  @IsString()
  name_en: string;
}

export class UpdateTariffType {
  @ApiProperty({ type: String, required: false, example: 'TURBO' })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'TURBO' })
  @IsOptional()
  @IsString()
  name_en: string;
}
