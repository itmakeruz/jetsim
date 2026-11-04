import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateResellerDto {
  @IsString()
  @Length(2, 100)
  name: string;

  /** Валюта компании: баланс, цены и заказы — только в ней; после создания не меняется. По умолчанию RUB */
  @IsOptional()
  @IsEnum(['RUB', 'USD'])
  currency?: 'RUB' | 'USD';
}

export class UpdateResellerDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'BLOCKED'])
  status?: 'ACTIVE' | 'BLOCKED';
}

export class IssueKeyDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;
}

export class UpsertResellerTariffDto {
  /** Закупочная цена компании в минорных единицах её валюты (копейки/центы) */
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  price_kopecks: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MoneyOperationDto {
  /** Сумма в минорных единицах валюты компании (копейки/центы): для пополнения > 0, для корректировки — со знаком, ≠ 0 */
  @IsInt()
  @Min(-1_000_000_000_000)
  @Max(1_000_000_000_000)
  amount_kopecks: number;

  @IsString()
  @Length(3, 500)
  comment: string;

  /** Ключ идемпотентности: ретрай с тем же ключом не двигает деньги второй раз */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{1,128}$/)
  idempotency_key?: string;
}

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  size?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reseller_id?: number;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  before_id?: number;
}

export class ResolveOrderDto {
  /** Что установлено по итогам сверки с поставщиком */
  @IsEnum(['FAILED', 'ISSUED'])
  outcome: 'FAILED' | 'ISSUED';

  @IsString()
  @Length(3, 500)
  comment: string;
}

export class RefundOrderDto {
  /** Подтверждаю: возврат поставщиком получен/согласован — деньги можно вернуть компании */
  @IsBoolean()
  provider_confirmed: boolean;

  @IsString()
  @Length(3, 500)
  comment: string;
}

export class CancelOrderDto {
  @IsString()
  @Length(3, 500)
  comment: string;
}
