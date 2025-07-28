import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const depositFields = Object.keys(prisma.tariff.fields);

class TariffFilter {
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

class TariffSort {
  @ApiProperty({ enum: depositFields })
  @IsIn(depositFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetTarifftDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffFilter)
  @ApiProperty({ type: TariffFilter, isArray: true, required: false })
  filters?: TariffFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TariffSort)
  @ApiProperty({ type: TariffSort, required: false })
  sort?: TariffSort;
}
