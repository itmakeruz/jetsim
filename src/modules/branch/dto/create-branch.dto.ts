import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateBranchDto {
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

  @ApiProperty({ type: Number, required: true })
  @IsNotEmpty()
  @IsNumber()
  region_id: number;
}
