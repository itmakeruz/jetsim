import axios from 'axios';
import { BillionConnectService } from './billion-connect.gateway';

jest.mock('axios');

/**
 * BillionConnect сообщил, что orderCreateTime в заказе #4580 пришёл на
 * ~6 часов раньше фактического момента запроса (прислали 13 окт 21:33
 * вместо реальных 14 окт 03:44). Причина — formatDateTime() брал
 * d.getHours()/d.getFullYear() и т.д., которые читают часовой пояс
 * процесса Node, а не Asia/Shanghai, которого ждёт их API.
 *
 * Тест нарочно выставляет серверу ДРУГОЙ часовой пояс (America/New_York) —
 * именно так баг и проявлялся бы на реальном сервере, если его TZ не
 * совпадает с Шанхаем, — и проверяет, что отправленное время всё равно
 * верное для Asia/Shanghai.
 */
describe('BillionConnectService — таймзона исходящих запросов', () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTZ;
    jest.useRealTimers();
  });

  it('tradeTime/orderCreateTime считаются в Asia/Shanghai независимо от TZ процесса', async () => {
    process.env.TZ = 'America/New_York';

    const post = jest.fn().mockResolvedValue({ data: { tradeCode: '1000' } });
    (axios.create as jest.Mock).mockReturnValue({ post });

    const service = new BillionConnectService({ log: jest.fn(), error: jest.fn() } as any);

    // 2026-10-14 03:44:00 по Шанхаю (UTC+8) — ровно момент из письма BillionConnect.
    const knownInstant = new Date('2026-10-13T19:44:00.000Z');
    jest.useFakeTimers().setSystemTime(knownInstant);

    await service.createEsimOrder({
      channelOrderId: '4580',
      subOrderList: [{ channelSubOrderId: '4580', deviceSkuId: 'SKU', planSkuCopies: '1', number: '1' }],
    });

    const sentBody = JSON.parse(post.mock.calls[0][1] as string);

    expect(sentBody.tradeTime).toBe('2026-10-14 03:44:00');
    expect(sentBody.tradeData.orderCreateTime).toBe('2026-10-14 03:44:00');
  });

  it('полночь по Шанхаю форматируется как 00:00:00, а не 24:00:00', async () => {
    const post = jest.fn().mockResolvedValue({ data: { tradeCode: '1000' } });
    (axios.create as jest.Mock).mockReturnValue({ post });

    const service = new BillionConnectService({ log: jest.fn(), error: jest.fn() } as any);

    const midnightShanghai = new Date('2026-10-13T16:00:00.000Z'); // 2026-10-14 00:00:00 +08:00
    jest.useFakeTimers().setSystemTime(midnightShanghai);

    await service.createEsimOrder({
      channelOrderId: '1',
      subOrderList: [{ channelSubOrderId: '1', deviceSkuId: 'SKU', planSkuCopies: '1', number: '1' }],
    });

    const sentBody = JSON.parse(post.mock.calls[0][1] as string);
    expect(sentBody.tradeTime).toBe('2026-10-14 00:00:00');
  });
});
