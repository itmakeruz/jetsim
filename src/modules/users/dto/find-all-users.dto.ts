import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationOptionalDto } from '@enums';

export class GetUsersDto extends PaginationOptionalDto {
  @ApiProperty({ type: String, required: false, example: '3405', description: 'ID пользователя' })
  @IsOptional()
  // Строкой, а не числом: при вводе букв @IsNumber отдал бы 400,
  // вместо этого сервис просто не найдёт совпадений
  @IsString()
  id?: string;

  @ApiProperty({ type: String, required: false, example: 'Иванов', description: 'Имя' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: String, required: false, example: 'client@mail.ru', description: 'Email' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ type: String, required: false, example: '+7988', description: 'Телефон' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiProperty({ type: Boolean, required: false, description: 'Подтверждён ли email' })
  @IsOptional()
  // Boolean('false') === true, поэтому строку из query разбираем вручную,
  // а не через @Type(() => Boolean)
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  is_verified?: boolean;

  @ApiProperty({ type: String, required: false, example: '2026-09-01', description: 'Дата регистрации с' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({ type: String, required: false, example: '2026-09-25', description: 'Дата регистрации по' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Общий поиск по ID, имени, email и телефону. Оставлен для обратной совместимости',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
