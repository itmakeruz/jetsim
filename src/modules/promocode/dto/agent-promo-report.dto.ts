import { ApiProperty } from '@nestjs/swagger';
import { PromoCodeCreationMode, PromoUsageStatus, Status, TransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AgentPromoReportQueryDto {
  @ApiProperty({ required: false, example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({ required: false, example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiProperty({ required: false, example: 'LAZIZ2525' })
  @IsOptional()
  @IsString()
  promo_code?: string;

  @ApiProperty({ required: false, enum: PromoUsageStatus, default: PromoUsageStatus.CONFIRMED })
  @IsOptional()
  @IsEnum(PromoUsageStatus)
  status?: PromoUsageStatus;
}

export class AdminPromoReportQueryDto extends AgentPromoReportQueryDto {
  @ApiProperty({ required: false, example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agent_id?: number;

  @ApiProperty({ required: false, example: 'agent_login' })
  @IsOptional()
  @IsString()
  agent_login?: string;

  @ApiProperty({ required: false, example: 'Agent name' })
  @IsOptional()
  @IsString()
  agent_name?: string;

  @ApiProperty({ required: false, example: 'client@mail.com' })
  @IsOptional()
  @IsString()
  client_email?: string;

  @ApiProperty({ required: false, example: '+998901234567' })
  @IsOptional()
  @IsString()
  client_phone?: string;

  @ApiProperty({ required: false, example: 123 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transaction_id?: number;

  @ApiProperty({ required: false, example: 456 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order_id?: number;

  @ApiProperty({ required: false, enum: PromoCodeCreationMode })
  @IsOptional()
  @IsEnum(PromoCodeCreationMode)
  creation_mode?: PromoCodeCreationMode;

  @ApiProperty({ required: false, enum: Status })
  @IsOptional()
  @IsEnum(Status)
  promocode_status?: Status;

  @ApiProperty({ required: false, enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  transaction_status?: TransactionStatus;
}
