import { InvalidAmountException } from '../b2b.errors';

/** Деньги внутри B2B — целые копейки (bigint). Наружу отдаём number. */
export type Kopecks = bigint;

/** Принимает целое число копеек из API/DTO; дробные и небезопасные значения отвергает. */
export function parseKopecks(value: unknown): Kopecks {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  throw new InvalidAmountException('Сумма должна быть целым числом копеек');
}

export function toNumber(value: Kopecks): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Kopecks value exceeds the safe integer range');
  return n;
}
