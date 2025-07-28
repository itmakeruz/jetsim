import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { IsString } from 'class-validator';
import { IsEnum } from 'class-validator';

export class CreatePackageDto {
  @ApiProperty({ type: Number, required: true, example: 100 })
  @IsNotEmpty()
  @IsNumber()
  sms_count: number;

  @ApiProperty({ type: Number, required: true, example: 100 })
  @IsNotEmpty()
  @IsNumber()
  minutes_count: number;

  @ApiProperty({ type: Number, required: true, example: 100 })
  @IsNotEmpty()
  @IsNumber()
  mb_count: number;

  @ApiProperty({ type: String, required: true, example: 'sku_id' })
  @IsNotEmpty()
  @IsString()
  sku_id: string;

  @ApiProperty({ type: String, required: true, example: 'status', enum: Status })
  @IsNotEmpty()
  @IsEnum(Status)
  status: Status;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsNumber()
  tariff_id: number;
}
