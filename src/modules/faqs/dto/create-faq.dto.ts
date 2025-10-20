import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({ type: String, required: true, example: 'Как оплатить заказ?' })
  @IsNotEmpty()
  @IsString()
  question_ru: string;

  @ApiProperty({ type: String, required: true, example: 'Как оплатить заказ?' })
  @IsNotEmpty()
  @IsString()
  question_en: string;

  @ApiProperty({
    type: String,
    required: true,
    example:
      'Вы можете оплатить заказ при получении наличными или банковской картой, либо онлайн через нашу платежную систему.',
  })
  @IsNotEmpty()
  @IsString()
  answer_ru: string;

  @ApiProperty({
    type: String,
    required: true,
    example:
      'Вы можете оплатить заказ при получении наличными или банковской картой, либо онлайн через нашу платежную систему.',
  })
  @IsNotEmpty()
  @IsString()
  answer_en: string;

  @ApiProperty({ type: String, required: true, example: 'ACTIVE', enum: Status })
  @IsNotEmpty()
  @IsString()
  status: Status;
}
