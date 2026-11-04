/**
 * Исход отправки заявки поставщику — ключевое различие для денег:
 *  ACCEPTED — поставщик принял заявку (eSIM придёт колбэком);
 *  REJECTED — ДОСТОВЕРНЫЙ отказ (ответ поставщика с отказом или HTTP 4xx) → резерв освобождаем;
 *  UNKNOWN  — таймаут/обрыв/5xx: заявка могла дойти и быть оплачена → резерв держим до сверки,
 *             автоматически повторно НЕ покупаем.
 */
export type SubmitOutcome =
  | { kind: 'ACCEPTED'; response?: unknown }
  | { kind: 'REJECTED'; reason: string; response?: unknown }
  | { kind: 'UNKNOWN'; reason: string };

export interface ProviderSubmitInput {
  resellerOrderId: number;
  /** «Оболочка» заказа (Order) — нужна существующим обработчикам провайдеров и истории событий */
  orderId: number;
  simId: number;
  userId: number;
  userName: string | null;
  /** Sims.partner_id (строка Partner) — для истории событий */
  partnerId: number;
  /** Partner.identified_number: 1 — JoyTel, 2 — BillionConnect, 3 — Mobiline */
  providerNumber: number;
  tariff: { id: number; sku_id: string; validity_period: number | null };
}

/**
 * Абстрактный класс служит и DI-токеном. Реализация обязана:
 *  - вызвать поставщика не более одного раза за вызов и никогда не повторять покупку сама;
 *  - при ACCEPTED/REJECTED довести строку Sims до соответствующего статуса;
 *  - при UNKNOWN оставить Sims в PENDING (не FAILED!) — дальше разбирается сверка.
 */
export abstract class ProviderSubmitter {
  abstract submit(input: ProviderSubmitInput): Promise<SubmitOutcome>;
}

/** Оповещения операторов о заказах, требующих ручной сверки */
export abstract class B2bAlerts {
  abstract reconcileNeeded(info: { resellerOrderId: number; resellerName: string; reason: string }): Promise<void>;
}
