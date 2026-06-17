import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ValidatePromoCodeDto {
  @ApiProperty({ example: 'LAZIZ2525' })
  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code: string;
}
