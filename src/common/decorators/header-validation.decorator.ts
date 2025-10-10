import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeviceHeadersDto } from '@enums';

export const HeadersValidation = createParamDecorator(async (data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const headers = request.headers;

  const headersDto = plainToInstance(DeviceHeadersDto, headers);

  const errors = await validate(headersDto);

  if (errors.length > 0) {
    const messages = errors.flatMap((err) => Object.values(err.constraints || {}));
    throw new BadRequestException(messages);
  }

  return { ...headersDto, lang: headersDto?.lang?.toLowerCase() ?? 'ru' };
});
