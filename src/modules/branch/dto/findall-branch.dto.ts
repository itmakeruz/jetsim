import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const depositFields = Object.keys(prisma.branch.fields);

class BranchFilter {
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

class BranchSort {
  @ApiProperty({ enum: depositFields })
  @IsIn(depositFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetBranchtDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchFilter)
  @ApiProperty({ type: BranchFilter, isArray: true })
  filters?: BranchFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BranchSort)
  @ApiProperty({ type: BranchSort })
  sort?: BranchSort;
}
