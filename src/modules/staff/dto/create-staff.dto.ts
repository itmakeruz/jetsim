import { ApiProperty } from '@nestjs/swagger';
import { Status, UserRoles } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ type: String, required: true, example: 'Test test test' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ type: String, required: true, example: 'Test' })
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty({ type: String, required: true, example: 'Test' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ type: String, required: true, example: 'Test', enum: UserRoles })
  @IsNotEmpty()
  @IsString()
  role: UserRoles;

  @ApiProperty({ type: String, required: true, example: 'Test', enum: Status })
  @IsNotEmpty()
  @IsString()
  status: Status;
}
