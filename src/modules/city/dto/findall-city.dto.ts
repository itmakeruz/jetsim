import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const depositFields = Object.keys(prisma.city.fields);

class CityFilter {
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

class CitySort {
  @ApiProperty({ enum: depositFields })
  @IsIn(depositFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetCityDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CityFilter)
  @ApiProperty({ type: CityFilter, isArray: true })
  filters?: CityFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CitySort)
  @ApiProperty({ type: CitySort })
  sort?: CitySort;
}
