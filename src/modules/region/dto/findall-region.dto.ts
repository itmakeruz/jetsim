import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const depositFields = Object.keys(prisma.region.fields);

class RegionFilter {
  @IsIn(depositFields)
  @ApiProperty({ enum: depositFields })
  column: string;

  @IsEnum(OperatorTypes)
  @ApiProperty({ enum: OperatorTypes })
  operator: OperatorTypes;

  @IsString()
  @ApiProperty({ type: String })
  value: string;
}

class RegionSort {
  @ApiProperty({ enum: depositFields })
  @IsIn(depositFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetRegionDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegionFilter)
  @ApiProperty({ type: RegionFilter, isArray: true, required: false })
  filters?: RegionFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RegionSort)
  @ApiProperty({ type: RegionSort, required: false })
  sort?: RegionSort;

  @ApiProperty({ type: String, required: false, example: 'kent' })
  @IsOptional()
  @IsString()
  search: string;

  @ApiProperty({ type: Number, required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  category_id: number;
}
