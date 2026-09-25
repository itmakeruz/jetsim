import { PartnerIds } from '@enums';
import { SimStatus } from '@prisma/client';

/**
 * Какой статус выставить по ответу партнёра.
 * `undefined` — оставить как есть: партнёр не дал внятного ответа.
 *
 * Понижать статус умеем только для JoyTel — у него есть документированный код
 * «использована» (`data.status === '2'`). У BillionConnect такого признака в
 * контракте нет, а пустой `tradeData` приходит и при временной ошибке, поэтому
 * там разрешён только переход в ACTIVATED: иначе одна неудачная проверка
 * стёрла бы уже зафиксированный факт активации.
 */
export function resolveSimStatus(partnerId: number, response: any): SimStatus | undefined {
  if (partnerId === PartnerIds.JOYTEL) {
    if (response?.code !== undefined && response.code !== '000') {
      return undefined;
    }

    const status = response?.data?.status;
    if (status === '1') return SimStatus.ACTIVATED;
    if (status === '2') return SimStatus.EXPIRED;

    return undefined;
  }

  if (partnerId === PartnerIds.BILLION_CONNECT) {
    const tradeData = response?.tradeData;
    if (!Array.isArray(tradeData)) return undefined;

    return tradeData.some((el: any) => el?.status === 2) ? SimStatus.ACTIVATED : undefined;
  }

  return undefined;
}
