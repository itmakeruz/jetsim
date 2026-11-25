import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDefined, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

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

export class ImportTariffRowDto {
  @IsString() @Length(1, 100) sku_id: string;
  /** Поставщик: ID или название */
  @IsDefined() partner: string | number;
  @IsString() @Length(1, 200) name_ru: string;
  @IsString() @Length(1, 200) name_en: string;
  @IsNumber() data_gb: number;
  @IsNumber() validity_days: number;
  @IsOptional() @IsNumber() sms?: number;
  @IsOptional() @IsNumber() minutes?: number;
  @IsOptional() @IsBoolean() is_4g?: boolean;
  @IsOptional() @IsBoolean() is_5g?: boolean;
  /** Группа регионов: ID или название */
  @IsDefined() region_group: string | number;
  @IsOptional() @IsEnum(['local', 'regional', 'global']) kind?: 'local' | 'regional' | 'global';
  /** Себестоимость, рубли */
  @IsNumber() cost_rub: number;
  /** Цена для компании в её валюте (рубли или доллары), не в копейках */
  @IsNumber() company_price: number;
}

export class ImportTariffsDto {
  /** true — только проверка и план без записи */
  @IsBoolean() dry_run: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportTariffRowDto)
  items: ImportTariffRowDto[];
}

/** Фильтры и порядок списка тарифов компании. Цены — в минорных единицах валюты компании (копейки/центы). */
export class ResellerTariffsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) size?: number;
  /** Часть названия (RU/EN) или точный ID тарифа */
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) data_gb?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) validity_days?: number;
  @IsOptional() @IsEnum(['true', 'false']) active?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000) min_price_kopecks?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000) max_price_kopecks?: number;
  @IsOptional() @IsEnum(['id', 'name', 'data_gb', 'validity_days', 'price']) sort?: 'id' | 'name' | 'data_gb' | 'validity_days' | 'price';
  @IsOptional() @IsEnum(['asc', 'desc']) order?: 'asc' | 'desc';
}
