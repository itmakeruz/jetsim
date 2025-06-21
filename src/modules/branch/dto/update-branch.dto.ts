import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateBranchDto {
  @ApiProperty({ type: String, required: false })
  @IsNotEmpty()
  @IsString()
  name_uz: string;

  @ApiProperty({ type: String, required: false })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: false })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({ type: Number, required: false })
  @IsNotEmpty()
  @IsNumber()
  region_id: number;
}
