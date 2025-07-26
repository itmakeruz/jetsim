import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  description_en: string;
}
