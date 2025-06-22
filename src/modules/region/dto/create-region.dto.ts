import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  name_uz: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true })
  @IsNotEmpty()
  @IsString()
  name_en: string;
}
