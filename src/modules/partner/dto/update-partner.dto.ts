import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PartnerIds } from '@enums';

export class UpdatePartnerDto {
  @ApiProperty({ type: String, required: true, example: 'Partner Name (RU)' })
  @IsOptional()
  @IsString()
  name_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Partner Name (EN)' })
  @IsOptional()
  @IsString()
  name_en: string;

  @ApiProperty({ type: String, required: true, example: 'Description (RU)' })
  @IsOptional()
  @IsString()
  description_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Description (EN)' })
  @IsOptional()
  @IsString()
  description_en: string;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsOptional()
  @IsEnum(PartnerIds)
  identified_number: number;

  @ApiProperty({ enum: Status, required: true, example: Status.ACTIVE })
  @IsOptional()
  @IsEnum(Status)
  status: Status;
}
