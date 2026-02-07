import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const transactionFields = Object.keys(prisma.transaction.fields);

class TransactionFilter {
  @IsIn(transactionFields)
  @ApiProperty({ enum: transactionFields })
  column: string;

  @IsEnum(OperatorTypes)
  @ApiProperty({ enum: OperatorTypes })
  operator: OperatorTypes;

  @IsString()
  @ApiProperty({ type: String })
  value: string;
}

class TransactionSort {
  @ApiProperty({ enum: transactionFields })
  @IsIn(transactionFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetTransactionDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionFilter)
  @ApiProperty({ type: TransactionFilter, isArray: true, required: false })
  filters?: TransactionFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionSort)
  @ApiProperty({ type: TransactionSort, required: false })
  sort?: TransactionSort;

  @ApiProperty({ type: Number, required: false, example: 123, description: 'Transaction ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @ApiProperty({ type: String, required: false, example: 'user@mail.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ type: String, required: false, example: '1500' })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiProperty({
    type: String,
    required: false,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELED', 'REFUNDED', 'ERROR', 'UNKNOWN'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Single date (2026-02-01) or range (2026-02-01_2026-02-07)',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsString()
  created_at?: string;
}
