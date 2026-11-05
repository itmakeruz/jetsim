import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Отмена заказа сотрудником: причина обязательна и попадает в историю заказа. */
export class CancelAdminOrderDto {
  @ApiProperty({ example: 'Клиент передумал, деньги возвращены наличными' })
  @IsString()
  @Length(3, 1000)
  reason: string;
}
