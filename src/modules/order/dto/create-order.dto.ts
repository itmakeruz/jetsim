import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNotEmpty()
  @IsString()
  package_id: number;
}
