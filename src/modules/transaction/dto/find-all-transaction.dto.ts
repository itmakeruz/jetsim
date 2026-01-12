import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
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

  @ApiProperty({ type: String, required: false, example: 'john, 1000, SUCCESS' })
  @IsOptional()
  @IsString()
  search: string;
}
