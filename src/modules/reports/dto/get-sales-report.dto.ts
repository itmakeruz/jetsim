import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { SimStatus } from '@prisma/client';
import { PaginationOptionalDto } from '@enums';

export class GetSalesReportDto extends PaginationOptionalDto {
  @ApiProperty({
    type: String,
    required: false,
    example: '2026-09-01_2026-09-25',
    description: 'Период в формате <начало>_<конец>; тот же контракт, что у /dashboard',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ type: String, required: false, example: 'Таиланд', description: 'Название тарифа' })
  @IsOptional()
  @IsString()
  tariff?: string;

  @ApiProperty({ type: String, required: false, example: 'client@mail.ru', description: 'Имя или email покупателя' })
  @IsOptional()
  @IsString()
  buyer?: string;

  @ApiProperty({ type: String, required: false, example: '89812003919131', description: 'ICCID' })
  @IsOptional()
  @IsString()
  iccid?: string;

  @ApiProperty({ type: Number, required: false, example: 10, description: 'Объём трафика, ГБ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  internet?: number;

  @ApiProperty({ type: Number, required: false, example: 500, description: 'Сумма от, ₽' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount_from?: number;

  @ApiProperty({ type: Number, required: false, example: 2000, description: 'Сумма до, ₽' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount_to?: number;

  @ApiProperty({ enum: SimStatus, required: false, description: 'Статус активации eSIM' })
  @IsOptional()
  @IsEnum(SimStatus)
  sim_status?: SimStatus;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Общий поиск по тарифу и покупателю. Оставлен для обратной совместимости',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
