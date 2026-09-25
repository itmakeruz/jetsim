import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationOptionalDto } from '@enums';

export class GetUsersDto extends PaginationOptionalDto {
  @ApiProperty({
    type: String,
    required: false,
    example: 'client@example.com',
    description: 'Поиск по ID, имени, email или телефону',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
