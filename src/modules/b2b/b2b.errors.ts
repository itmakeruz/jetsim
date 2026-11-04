import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

/**
 * Доменные ошибки B2B API. У каждой есть машинный `code` — клиент партнёра
 * ветвится по нему, а не по тексту. Текст — человекочитаемый, без внутренних деталей.
 */
export class InsufficientFundsException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'INSUFFICIENT_FUNDS', message: 'Недостаточно средств на балансе компании' });
  }
}

export class PriceChangedException extends ConflictException {
  constructor() {
    super({ code: 'PRICE_CHANGED', message: 'Цена тарифа изменилась — обновите каталог и повторите покупку' });
  }
}

export class IdempotencyConflictException extends ConflictException {
  constructor() {
    super({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'client_order_id уже использован с другими параметрами заказа',
    });
  }
}

export class TariffUnavailableException extends UnprocessableEntityException {
  constructor() {
    super({ code: 'TARIFF_UNAVAILABLE', message: 'Тариф недоступен для этой компании' });
  }
}

export class ResellerBlockedException extends ForbiddenException {
  constructor() {
    super({ code: 'COMPANY_BLOCKED', message: 'Компания заблокирована — новые покупки запрещены' });
  }
}

export class OrderNotFoundException extends NotFoundException {
  constructor() {
    super({ code: 'ORDER_NOT_FOUND', message: 'Заказ не найден' });
  }
}

export class NotIssuedException extends ConflictException {
  constructor() {
    super({ code: 'NOT_ISSUED', message: 'eSIM ещё не выдана' });
  }
}

/** Операция недопустима в текущем состоянии заказа/журнала (напр. release после capture) */
export class InvalidStateException extends ConflictException {
  constructor(message = 'Операция недопустима в текущем состоянии') {
    super({ code: 'INVALID_STATE', message });
  }
}

export class InvalidAmountException extends UnprocessableEntityException {
  constructor(message = 'Некорректная сумма') {
    super({ code: 'INVALID_AMOUNT', message });
  }
}
