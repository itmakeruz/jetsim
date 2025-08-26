import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OperatorTypes, PaginationOptionalDto } from '@enums';
import { prisma } from '@helpers';

const partnerFields = Object.keys(prisma.partner.fields);

class PartnerFilter {
  @IsIn(partnerFields)
  @ApiProperty({ enum: partnerFields })
  column: string;

  @IsEnum(OperatorTypes)
  @ApiProperty({ enum: OperatorTypes })
  operator: OperatorTypes;

  @IsString()
  @ApiProperty({ type: String })
  value: string;
}

class PartnerSort {
  @ApiProperty({ enum: partnerFields })
  @IsIn(partnerFields)
  column: string;

  @IsEnum(Prisma.SortOrder)
  @ApiProperty({ enum: Prisma.SortOrder })
  value: Prisma.SortOrder;
}

export class GetAllPartnerDto extends PaginationOptionalDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerFilter)
  @ApiProperty({ type: PartnerFilter, isArray: true, required: false })
  filters?: PartnerFilter[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PartnerSort)
  @ApiProperty({ type: PartnerSort, required: false })
  sort?: PartnerSort;
}
