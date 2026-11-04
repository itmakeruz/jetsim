import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export enum ManualPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

/** Заказ, оформленный сотрудником в админке: оплату принял сотрудник, онлайн-платежа нет. */
export class CreateAdminOrderDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  tariff_id: number;

  @ApiPropertyOptional({ example: 1, description: 'Сколько eSIM выдать, 1–10' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;

  @ApiProperty({ example: 'client@example.com', description: 'Сюда уйдёт письмо с eSIM' })
  @IsEmail()
  client_email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  client_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 32)
  client_phone?: string;

  @ApiProperty({ enum: ManualPaymentMethod })
  @IsEnum(ManualPaymentMethod)
  payment_method: ManualPaymentMethod;

  @ApiPropertyOptional({ description: 'Комментарий сотрудника; виден в истории заказа' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  comment?: string;

  /** Защита от двойного клика: повтор с тем же request_id вернёт тот же заказ, а не выпустит ещё eSIM */
  @ApiPropertyOptional({ description: 'UUID попытки; повтор не создаёт второй заказ' })
  @IsOptional()
  @IsUUID()
  request_id?: string;
}
