import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class RemoveFromBasketDto {
  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  item_id: number;
}

export class DecreaseQuantityDto {
  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  item_id: number;
}
