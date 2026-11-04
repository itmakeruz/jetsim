import { InternalServerErrorException } from '@nestjs/common';

/**
 * Ошибка обращения к поставщику с сохранённой информацией о том, ДОШЁЛ ли запрос:
 *  providerStatus задан — поставщик ответил HTTP-статусом (4xx = запрос отвергнут, 5xx = неясно);
 *  providerStatus не задан — ответа не было (таймаут/обрыв): заявка могла быть обработана.
 * Розничный код видит обычный InternalServerErrorException и ведёт себя как раньше.
 */
export class ProviderRequestError extends InternalServerErrorException {
  constructor(
    message: string,
    readonly providerStatus?: number,
    readonly providerBody?: unknown,
  ) {
    super(message);
  }
}
