import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
export class UpdateServiceDto {
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name_en: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  description_en: string;
}
