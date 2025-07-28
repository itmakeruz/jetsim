import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsEnum, IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdatePackageDto {
  @ApiProperty({ type: Number, required: false, example: 100 })
  @IsOptional()
  @IsNumber()
  sms_count: number;

  @ApiProperty({ type: Number, required: false, example: 100 })
  @IsOptional()
  @IsNumber()
  minutes_count: number;

  @ApiProperty({ type: Number, required: false, example: 100 })
  @IsOptional()
  @IsNumber()
  mb_count: number;

  @ApiProperty({ type: String, required: false, example: 'sku_id' })
  @IsOptional()
  @IsString()
  sku_id: string;

  @ApiProperty({ type: String, required: false, example: 'status', enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status: Status;

  @ApiProperty({ type: Number, required: false, example: 1 })
  @IsOptional()
  @IsNumber()
  tariff_id: number;
}
