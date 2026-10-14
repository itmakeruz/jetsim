import { OrderStatus } from '@prisma/client';
import { CreateSimService } from './create-sim.service';

/**
 * Проактивный запрос статуса JoyTel сразу после отправки заказа — не ждём
 * пассивно колбэк, а сами спрашиваем, не готов ли уже snPin. Это гонка с
 * вебхуком /order/joytel/callback, и критично, чтобы при совпадении оба
 * пути не запросили QR дважды. См. order.service.ts#redeemCoupon — там та
 * же атомарная защита через updateMany({where: {status: REDEEM_COUPON}}).
 */
describe('CreateSimService — проактивный запрос статуса JoyTel', () => {
  const baseItem = {
    id: 3319,
    tariff: { sku_id: 'SKU' },
    user: { name: 'Клиент', email: 'client@example.com' },
  };

  const submitResponse = {
    code: 0,
    data: { orderTid: 'TID-1', orderCode: 'CODE-1' },
  };

  function buildService(overrides: {
    queryOrderStatus?: jest.Mock;
    updateManyResult?: { count: number };
    redeemCouponForQrCode?: jest.Mock;
  }) {
    const simsUpdate = jest.fn().mockResolvedValue({});
    const simsUpdateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 }) // claimSim: CREATED -> PENDING
      .mockResolvedValueOnce(overrides.updateManyResult ?? { count: 1 }); // REDEEM_COUPON -> NOTIFY_COUPON

    const prisma = {
      sims: {
        update: simsUpdate,
        updateMany: simsUpdateMany,
      },
    };

    const joyTel = {
      submitEsimOrder: jest.fn().mockResolvedValue(submitResponse),
      queryOrderStatus: overrides.queryOrderStatus ?? jest.fn().mockResolvedValue({ code: 0, data: {} }),
      redeemCouponForQrCode: overrides.redeemCouponForQrCode ?? jest.fn().mockResolvedValue({}),
    };

    const orderEvents = { record: jest.fn() };
    const telegram = { notifyOrderSuccess: jest.fn(), notifyOrderError: jest.fn() };

    const service = new CreateSimService(
      prisma as any,
      joyTel as any,
      { log: jest.fn(), error: jest.fn() } as any,
      {} as any,
      telegram as any,
      orderEvents as any,
    );

    return { service, prisma, joyTel, orderEvents, telegram, simsUpdateMany };
  }

  it('получает snPin проактивным запросом и сразу запрашивает QR, не дожидаясь колбэка', async () => {
    const queryOrderStatus = jest.fn().mockResolvedValue({
      code: 0,
      data: {
        orderTid: 'TID-1',
        orderCode: 'CODE-1',
        itemList: [{ productCode: 'SKU', snList: [{ snCode: 'SN1', snPin: 'PIN1', snPuk: 'PUK1' }] }],
      },
    });
    const redeemCouponForQrCode = jest.fn().mockResolvedValue({});
    const { service, joyTel, orderEvents } = buildService({ queryOrderStatus, redeemCouponForQrCode });

    const result = await service.processJoyTel(1, 1, baseItem);

    expect(result).toBe(true);
    expect(joyTel.redeemCouponForQrCode).toHaveBeenCalledWith('PIN1');
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'joytel_snpin_query_succeeded' }),
    );
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'joytel_qr_requested' }),
    );
  });

  it('если колбэк уже забрал snPin раньше — проактивный путь не запрашивает QR повторно', async () => {
    const queryOrderStatus = jest.fn().mockResolvedValue({
      code: 0,
      data: {
        orderTid: 'TID-1',
        orderCode: 'CODE-1',
        itemList: [{ productCode: 'SKU', snList: [{ snCode: 'SN1', snPin: 'PIN1' }] }],
      },
    });
    const redeemCouponForQrCode = jest.fn();
    // Атомарный claim проигран: статус уже не REDEEM_COUPON (колбэк опередил)
    const { service, joyTel, orderEvents } = buildService({
      queryOrderStatus,
      redeemCouponForQrCode,
      updateManyResult: { count: 0 },
    });

    const result = await service.processJoyTel(1, 1, baseItem);

    expect(result).toBe(true);
    expect(joyTel.redeemCouponForQrCode).not.toHaveBeenCalled();
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'joytel_snpin_query_raced_callback' }),
    );
  });

  it('если snPin ещё не готов — просто фиксирует это и не трогает QR', async () => {
    const queryOrderStatus = jest.fn().mockResolvedValue({ code: 0, data: { orderTid: 'TID-1', orderCode: 'CODE-1' } });
    const { service, joyTel, orderEvents } = buildService({ queryOrderStatus });

    const result = await service.processJoyTel(1, 1, baseItem);

    expect(result).toBe(true);
    expect(joyTel.redeemCouponForQrCode).not.toHaveBeenCalled();
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'joytel_snpin_query_pending' }),
    );
  });

  it('падение проактивного запроса не ломает основной поток выдачи', async () => {
    const queryOrderStatus = jest.fn().mockRejectedValue(new Error('JoyTel query timeout'));
    const { service, orderEvents } = buildService({ queryOrderStatus });

    const result = await service.processJoyTel(1, 1, baseItem);

    expect(result).toBe(true);
    expect(orderEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'joytel_snpin_query_failed', severity: 'warning' }),
    );
  });
});
