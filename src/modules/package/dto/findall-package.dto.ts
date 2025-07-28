import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const depositFields = Object.keys(prisma.package.fields);

class PackageFilter {
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

class PackageSort {
  @ApiProperty({ enum: depositFields })
  @IsIn(depositFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetPackageDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageFilter)
  @ApiProperty({ type: PackageFilter, isArray: true, required: false })
  filters?: PackageFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PackageSort)
  @ApiProperty({ type: PackageSort, required: false })
  sort?: PackageSort;
}
