import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSupportOperatorsDto {
  @ApiProperty({ type: String, required: false, example: 'Nimadir Nimadirov' })
  @IsOptional()
  @IsString()
  @Min(3)
  @Max(25)
  operator_name: string;

  @ApiProperty({ type: String, required: false, example: 'nimadir123' })
  @IsOptional()
  @IsString()
  @Min(6)
  @Max(12)
  operator_login: string;

  @ApiProperty({ type: String, required: false, example: 'nimadir!@#' })
  @IsOptional()
  @IsString()
  @Min(8)
  @Max(12)
  operator_password: string;
}
