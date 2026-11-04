import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateB2bOrderDto {
  /** Идентификатор заказа на стороне клиента: повтор с теми же параметрами вернёт тот же заказ */
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{1,64}$/, { message: 'client_order_id: 1–64 символа [A-Za-z0-9_.:-]' })
  client_order_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  tariff_id: number;

  /** Версия цены из каталога: если цена успела измениться — покупка отклоняется */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price_version: number;

  @IsOptional()
  @IsEnum(['ADMIN', 'AGENT', 'API_KEY'])
  source?: 'ADMIN' | 'AGENT' | 'API_KEY';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source_ref?: string;
}

export class ListB2bOrdersQueryDto {
  /** Вернуть заказы, изменённые не раньше этого момента (для синхронизации), от старых к новым */
  @IsOptional()
  @IsISO8601()
  updated_since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Для обычного просмотра: вернуть заказы с id меньше указанного (от новых к старым) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  before_id?: number;
}
