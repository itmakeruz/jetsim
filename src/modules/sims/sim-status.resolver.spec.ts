import { PartnerIds } from '@enums';
import { SimStatus } from '@prisma/client';
import { resolveSimStatus } from './sim-status.resolver';

const BC = PartnerIds.BILLION_CONNECT;
const JT = PartnerIds.JOYTEL;

describe('resolveSimStatus', () => {
  describe('BillionConnect', () => {
    it('признаёт активированной симку со status === 2 (тот самый баг: в CRM висело «Не активирована»)', () => {
      expect(resolveSimStatus(BC, { tradeData: [{ status: 2 }] })).toBe(SimStatus.ACTIVATED);
    });

    it('находит признак активации в середине списка', () => {
      expect(resolveSimStatus(BC, { tradeData: [{ status: 1 }, { status: 2 }] })).toBe(SimStatus.ACTIVATED);
    });

    it('не трогает статус, если активации пока нет', () => {
      expect(resolveSimStatus(BC, { tradeData: [{ status: 1 }] })).toBeUndefined();
    });

    // Защита от регресса: пустой ответ приходит и при временной ошибке партнёра.
    // Если вернуть здесь null, активированная симка «разактивируется».
    it.each([
      ['пустой tradeData', { tradeData: [] }],
      ['tradeData отсутствует', {}],
      ['tradeData не массив', { tradeData: null }],
      ['пустой ответ', null],
    ])('не понижает статус: %s', (_label, response) => {
      expect(resolveSimStatus(BC, response)).toBeUndefined();
    });
  });

  describe('JoyTel', () => {
    it('status "1" → активирована', () => {
      expect(resolveSimStatus(JT, { code: '000', data: { status: '1' } })).toBe(SimStatus.ACTIVATED);
    });

    it('status "2" → использована', () => {
      expect(resolveSimStatus(JT, { code: '000', data: { status: '2' } })).toBe(SimStatus.EXPIRED);
    });

    it('игнорирует ответ с кодом ошибки', () => {
      expect(resolveSimStatus(JT, { code: '999', data: { status: '1' } })).toBeUndefined();
    });

    it('игнорирует неизвестный код статуса', () => {
      expect(resolveSimStatus(JT, { code: '000', data: { status: '7' } })).toBeUndefined();
    });

    it('работает, если партнёр не прислал code', () => {
      expect(resolveSimStatus(JT, { data: { status: '1' } })).toBe(SimStatus.ACTIVATED);
    });
  });

  it('неизвестный партнёр не меняет статус', () => {
    expect(resolveSimStatus(999, { tradeData: [{ status: 2 }] })).toBeUndefined();
  });
});
