import { ApiProperty } from '@nestjs/swagger';
import { Status, UserRoles } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class UpdateStaffDto {
  @ApiProperty({ type: String, required: false, example: 'Test test test' })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({ type: String, required: false, example: 'Test' })
  @IsOptional()
  @IsString()
  login: string;

  @ApiProperty({ type: String, required: false, example: 'Test' })
  @IsOptional()
  @IsString()
  password: string;

  @ApiProperty({ type: String, required: false, example: 'Test', enum: UserRoles })
  @IsOptional()
  @IsString()
  role: UserRoles;

  @ApiProperty({ type: String, required: false, example: 'Test', enum: Status })
  @IsOptional()
  @IsString()
  status: Status;
}
