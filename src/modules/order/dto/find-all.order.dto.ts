import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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

  @ApiProperty({
    type: String,
    required: false,
    example: '8931080019',
    description: 'Поиск по ID заказа, ICCID, имени, email или телефону клиента',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ type: String, required: false, example: 'client@mail.ru', description: 'Email клиента' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ type: String, required: false, example: '89812003919131', description: 'ICCID симки в заказе' })
  @IsOptional()
  @IsString()
  iccid?: string;

  @ApiProperty({ type: Number, required: false, example: 3458, description: 'Order ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @ApiProperty({ enum: OrderStatus, required: false, description: 'Order status' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ type: String, required: false, example: '2026-06-01', description: 'Created date from' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({ type: String, required: false, example: '2026-06-24', description: 'Created date to' })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}
