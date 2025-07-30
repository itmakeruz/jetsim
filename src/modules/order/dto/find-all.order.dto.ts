import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const orderFields = Object.keys(prisma.order.fields);

class OrderFilter {
  @IsIn(orderFields)
  @ApiProperty({ enum: orderFields })
  column: string;

  @IsEnum(OperatorTypes)
  @ApiProperty({ enum: OperatorTypes })
  operator: OperatorTypes;

  @IsString()
  @ApiProperty({ type: String })
  value: string;
}

class OrderSort {
  @ApiProperty({ enum: orderFields })
  @IsIn(orderFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetOrderDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderFilter)
  @ApiProperty({ type: OrderFilter, isArray: true, required: false })
  filters?: OrderFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderSort)
  @ApiProperty({ type: OrderSort, required: false })
  sort?: OrderSort;
}
