import { ApiProperty } from '@nestjs/swagger';
import { ParameterObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { IsEnum, IsOptional, IsString } from 'class-validator';

enum Lang {
  ru = 'ru',
  en = 'en',
}

export class DeviceHeadersDto {
  @IsEnum(Lang)
  'lang': Lang;

  // @ApiProperty({ type: String, required: false })
  // @IsOptional()
  // @IsString()
  // 'x-session-id': string;
}

export const globalHeaderParametrs: ParameterObject[] = [
  {
    in: 'header',
    name: 'lang',
    required: false,
    schema: {
      enum: ['ru', 'en'],
      type: 'string',
      default: 'ru',
    },
  },
  // {
  //   in: 'header',
  //   name: 'x-session-id',
  //   required: false,
  //   schema: {
  //     type: 'string',
  //   },
  // },
];
