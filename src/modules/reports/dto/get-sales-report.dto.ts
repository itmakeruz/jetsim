import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationOptionalDto } from '@enums';

export class GetSalesReportDto extends PaginationOptionalDto {
  @ApiProperty({
    type: String,
    required: false,
    example: '2026-09-01_2026-09-22',
    description: 'Период в формате <начало>_<конец>; тот же контракт, что у /dashboard',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({
    type: String,
    required: false,
    example: 'Таиланд',
    description: 'Поиск по названию тарифа, имени или email клиента',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
