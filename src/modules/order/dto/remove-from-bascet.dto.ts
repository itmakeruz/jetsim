import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, isNumber } from 'class-validator';

export class RemoveFromBasketDto {
  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  packeage_id: number;
}

export class DecreaseQuantityDto {
  @ApiProperty({ type: Number, required: true, example: 1 })
  @IsNumber()
  @IsNotEmpty()
  packeage_id: number;
}
