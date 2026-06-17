import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export enum PromoLimitType {
  ONCE = 'ONCE',
  UNLIMITED = 'UNLIMITED',
  CUSTOM = 'CUSTOM',
}

export enum PromoCodeRequestCreationMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export class CreatePromoCodeDto {
  @ApiProperty({ required: false, example: 'LAZIZ2525' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code?: string;

  @ApiProperty({ required: false, enum: PromoLimitType, default: PromoLimitType.UNLIMITED })
  @IsOptional()
  @IsEnum(PromoLimitType)
  limit_type?: PromoLimitType;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usage_limit?: number;

  @ApiProperty({ required: false, example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiProperty({ required: false, example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agent_id?: number;

  @ApiProperty({ required: false, enum: Status, default: Status.ACTIVE })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}

export class CreateAgentPromoCodeDto {
  @ApiProperty({
    required: false,
    enum: PromoCodeRequestCreationMode,
    default: PromoCodeRequestCreationMode.AUTO,
  })
  @IsOptional()
  @IsEnum(PromoCodeRequestCreationMode)
  creation_mode?: PromoCodeRequestCreationMode;

  @ApiProperty({ required: false, example: 'LAZIZ2525' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code?: string;

  @ApiProperty({ required: false, enum: PromoLimitType, default: PromoLimitType.UNLIMITED })
  @IsOptional()
  @IsEnum(PromoLimitType)
  limit_type?: PromoLimitType;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usage_limit?: number;

  @ApiProperty({ required: false, example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
