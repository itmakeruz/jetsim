import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFaqDto {
  @ApiProperty({ type: String, required: false, example: 'Как оплатить заказ?' })
  @IsOptional()
  @IsString()
  question_ru: string;

  @ApiProperty({ type: String, required: false, example: 'Как оплатить заказ?' })
  @IsOptional()
  @IsString()
  question_en: string;

  @ApiProperty({
    type: String,
    required: false,
    example:
      'Вы можете оплатить заказ при получении наличными или банковской картой, либо онлайн через нашу платежную систему.',
  })
  @IsOptional()
  @IsString()
  answer_ru: string;

  @ApiProperty({
    type: String,
    required: false,
    example:
      'Вы можете оплатить заказ при получении наличными или банковской картой, либо онлайн через нашу платежную систему.',
  })
  @IsOptional()
  @IsString()
  answer_en: string;

  @ApiProperty({ type: String, required: false, example: 'ACTIVE', enum: Status })
  @IsOptional()
  @IsString()
  status: Status;
}
