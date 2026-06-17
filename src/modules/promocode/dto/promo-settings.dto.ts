import { ApiProperty } from '@nestjs/swagger';
import { PromoCodeCreationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePromoSettingsDto {
  @ApiProperty({ required: false, example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  default_client_discount_amount?: number;

  @ApiProperty({ required: false, example: 700 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  default_agent_credit_amount?: number;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  is_agent_creation_enabled?: boolean;

  @ApiProperty({ required: false, enum: PromoCodeCreationMode })
  @IsOptional()
  @IsEnum(PromoCodeCreationMode)
  agent_creation_mode?: PromoCodeCreationMode;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  allow_limit_once?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  allow_limit_unlimited?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  allow_limit_custom?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  allow_no_expiry?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  allow_expires_at?: boolean;
}
