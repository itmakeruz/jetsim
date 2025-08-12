import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class AddToBasket {
  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  package_id: number;

  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}
