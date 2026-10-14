import axios from 'axios';
import { HttpService } from './http.service';

jest.mock('axios');

/**
 * HttpService — общий синглтон на всё приложение (один экземпляр
 * на JoyTel и TBank, см. http.module.ts), с состоянием через
 * setUrl()/setBody()/... вместо передачи конфига напрямую в send().
 *
 * Сам по себе такой "строитель" выглядит как классическая гонка: два
 * конкурентных заказа могли бы затереть друг другу url/body между вызовами.
 * На практике гонки нет — ЕСЛИ konfig всегда собирается синхронно внутри
 * send() ДО `await axios(config)`, а не читается из this.* лениво. Это и
 * проверяет тест: эмулирует два вызова на одном экземпляре, где ответ
 * первого искусственно задержан дольше второго — если бы send() читал
 * this.url/this.body после await, первый вызов получил бы данные второго.
 *
 * Если этот тест когда-нибудь станет падать — значит send() переписали так,
 * что гонка стала реальной, и тогда НУЖНО чинить HttpService по-настоящему
 * (например, передавать конфиг явным параметром, а не через this).
 */
describe('HttpService — конкурентные вызовы на одном экземпляре не путают данные', () => {
  it('ответ каждого вызова соответствует его собственным url/body, а не последнему setUrl()', async () => {
    const calls: any[] = [];
    (axios as unknown as jest.Mock).mockImplementation((config: any) => {
      calls.push(config);
      const delay = config.url === 'url-A' ? 50 : 0;
      return new Promise((resolve) => setTimeout(() => resolve({ data: { who: config.url } }), delay));
    });

    const http = new HttpService();

    const promiseA = http.setUrl('url-A').setBody({ client: 'A' }).send();
    const promiseB = http.setUrl('url-B').setBody({ client: 'B' }).send();

    const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

    expect(resultA).toEqual({ who: 'url-A' });
    expect(resultB).toEqual({ who: 'url-B' });
    expect(calls).toEqual([
      expect.objectContaining({ url: 'url-A', data: { client: 'A' } }),
      expect.objectContaining({ url: 'url-B', data: { client: 'B' } }),
    ]);
  });
});
