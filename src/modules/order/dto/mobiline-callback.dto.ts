import { Transform, Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

class MobilineEsimDto {
  @IsOptional() @IsString() product_type_cd?: string;
  @IsOptional() @IsString() cid?: string;
  @IsOptional() @IsString() qrcode?: string;
  @IsOptional() @IsString() pin1?: string;
  @IsOptional() @IsString() pin2?: string;
  @IsOptional() @IsString() puk1?: string;
  @IsOptional() @IsString() puk2?: string;
}
export class MobilineCallbackDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,200}$/) channel_order_id: string;
  @IsDefined()
  @Transform(({ obj }) => (typeof obj.ret === 'string' || typeof obj.ret === 'number' ? String(obj.ret) : undefined))
  @IsString()
  @IsNotEmpty()
  ret: string;
  @IsOptional() @IsString() msg?: string;
  @IsOptional() @IsString() application_id?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MobilineEsimDto) data?: MobilineEsimDto;
}
