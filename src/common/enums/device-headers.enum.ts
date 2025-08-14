import { ParameterObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { IsEnum } from 'class-validator';

enum Lang {
  ru = 'ru',
  en = 'en',
}

export class DeviceHeadersDto {
  @IsEnum(Lang)
  'lang': Lang;
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
];
