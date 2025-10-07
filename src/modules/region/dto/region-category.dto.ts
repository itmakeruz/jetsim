import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRegionCategoryDto {
  @ApiProperty({ type: String, required: true, example: 'Америка' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'USA' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Category icon',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  icon: string;
}

export class UpdateRegionCategoryDto {
  @ApiProperty({ type: String, required: false, example: 'Америка' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false, example: 'USA' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Region Category icon',
    example: 'icon.png',
    required: true,
    type: String,
    format: 'binary',
  })
  icon: string;
}
