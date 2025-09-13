import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateSupportOperatorsDto {
  @ApiProperty({ type: String, required: true, example: 'Nimadir Nimadirov' })
  @IsNotEmpty()
  @IsString()
  @Min(3)
  @Max(25)
  operator_name: string;

  @ApiProperty({ type: String, required: true, example: 'nimadir123' })
  @IsNotEmpty()
  @IsString()
  @Min(6)
  @Max(12)
  operator_login: string;

  @ApiProperty({ type: String, required: true, example: 'nimadir!@#' })
  @IsNotEmpty()
  @IsString()
  @Min(8)
  @Max(12)
  operator_password: string;
}
