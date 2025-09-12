import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ type: String, required: true, example: 'Partner Name (RU)' })
  @IsNotEmpty()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Partner Name (EN)' })
  @IsNotEmpty()
  @IsString()
  name_en: string;

  @ApiProperty({ type: String, required: true, example: 'Description (RU)' })
  @IsNotEmpty()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Description (EN)' })
  @IsNotEmpty()
  @IsString()
  description_en: string;

  @ApiProperty({ enum: Status, required: true })
  @IsNotEmpty()
  @IsEnum(Status)
  status: Status;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsNumber()
  identified_number: number;
}
