import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetUserInfosDto {
  @IsNotEmpty()
  @IsNumber()
  user_id: number;
}
