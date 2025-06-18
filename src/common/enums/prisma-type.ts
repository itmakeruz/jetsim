import { ApiProperty } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, IsNumberString, IsOptional } from 'class-validator';

export type Models = keyof Omit<
  PrismaClient,
  | '$transaction'
  | '$queryRawUnsafe'
  | '$queryRaw'
  | '$on'
  | '$extends'
  | '$executeRawUnsafe'
  | '$executeRaw'
  | '$disconnect'
  | '$connect'
  | '$use'
  | symbol
>;

export enum OperatorTypes {
  equals = 'equals',
  equal = 'equal',
  contains = 'contains',
  between = 'between',
  gte = 'gte',
  lte = 'lte',
}

export class PaginationDto {
  @ApiProperty({ type: String, default: '1' })
  @IsNumberString()
  page: number;

  @IsNumber()
  @ApiProperty({ type: String, default: '10' })
  size: number;
}

export class PaginationOptionalDto {
  @ApiProperty({ type: Number, default: '1', required: false })
  @IsOptional()
  @IsNumber()
  page: number;

  @ApiProperty({ type: Number, default: '10', required: false })
  @IsNumber()
  @IsOptional()
  size: number;
}

export class PaginationResponse<T> {
  @ApiProperty({ type: Number })
  totalPage: number;

  @ApiProperty({ type: Number })
  currentPage: number;

  @ApiProperty({ type: Boolean })
  hasNextPage: boolean;

  @ApiProperty({ type: Boolean })
  hasPreviousPage: boolean;

  @ApiProperty({ type: Number })
  totalItems: number;

  data: T;
}

export class ParamId {
  @ApiProperty({ type: String, required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  id: number;
}
