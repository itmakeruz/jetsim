import { MobilineActivationService } from './mobiline-activation.service';
import { MobilineCallbackDto } from './dto/mobiline-callback.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

jest.mock('@helpers', () => ({ QrService: class {}, saveQrCode: jest.fn() }));
const callback = {
  channel_order_id: 'GROUP20261027000001',
  ret: '0',
  application_id: 'APP',
  data: { product_type_cd: 'ESIM', cid: 'ICCID', qrcode: 'LPA:1$server$token', pin1: '1234', puk1: '87654321' },
};
function setup(status = 'CREATED') {
  const row: any = {
    id: 1,
    status,
    partner_id: 30,
    order_id: 9,
    user_id: 5,
    user: { name: 'Client', email: 'client@test.invalid' },
    tariff: { sku_id: 'SKU', validity_period: 10 },
  };
  const prisma = {
    sims: {
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        const matches =
          typeof where.status === 'string' ? row.status === where.status : where.status.in.includes(row.status);
        if (!matches) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      findFirst: jest.fn().mockImplementation(async () => ({ ...row })),
      findUnique: jest.fn().mockImplementation(async () => ({ ...row })),
    },
  };
  const client = {
    buildActivation: jest.fn().mockReturnValue({
      channel_order_id: callback.channel_order_id,
      group_id: 'GROUP',
      product_id: 'SKU',
      days: 10,
      quantity: 1,
    }),
    activate: jest.fn().mockResolvedValue({ ret: 0, data: { application_id: 'APP' } }),
  };
  const events = { record: jest.fn() };
  const qr = { generateQrWithLogo: jest.fn().mockResolvedValue(Buffer.from('png')) };
  const telegram = { notifyOrderSuccess: jest.fn(), notifyOrderError: jest.fn(), notifySimActivated: jest.fn() };
  const socket = { sendOrderMessage: jest.fn() };
  const service = new MobilineActivationService(
    prisma as any,
    client as any,
    events as any,
    qr as any,
    telegram as any,
    socket as any,
  );
  return { service, row, prisma, client, events, qr, telegram, socket };
}
describe('Mobiline activation and callbacks', () => {
  it('persists correlation before calling Mobiline and waits for the callback', async () => {
    const { service, client, row } = setup();
    client.activate.mockImplementation(async () => {
      expect(row.channel_order_id).toBe(callback.channel_order_id);
      expect(row.request).toMatchObject({ quantity: 1 });
      expect(row.status).toBe('PENDING');
      return { ret: 0, data: { application_id: 'APP' } };
    });
    await expect(service.submit(9, row)).resolves.toBe(true);
    expect(row).toMatchObject({ status: 'NOTIFY_COUPON', partner_order_id: 'APP' });
  });
  it('does not send another request on a repeated payment webhook', async () => {
    const { service, client, row } = setup();
    await Promise.all([service.submit(9, row), service.submit(9, row)]);
    expect(client.activate).toHaveBeenCalledTimes(1);
  });
  it('keeps uncertain requests pending without an automatic retry', async () => {
    const { service, client, row, events } = setup();
    client.activate.mockRejectedValue(new Error('timeout with secret in axios config'));
    await expect(service.submit(9, row)).resolves.toBe(true);
    expect(row.status).toBe('PENDING');
    await service.submit(9, row);
    expect(client.activate).toHaveBeenCalledTimes(1);
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'mobiline_submit_unknown' }));
    expect(JSON.stringify(events.record.mock.calls)).not.toContain('secret');
  });
  it('records explicit refusals as failed', async () => {
    const { service, client, row } = setup();
    client.activate.mockResolvedValue({ ret: '7', msg: 'Rejected' } as any);
    await expect(service.submit(9, row)).resolves.toBe(false);
    expect(row.status).toBe('FAILED');
  });
  it('accepts a request without application_id and logs the warning', async () => {
    const { service, client, row, events } = setup();
    client.activate.mockResolvedValue({ ret: '0' } as any);
    await expect(service.submit(9, row)).resolves.toBe(true);
    expect(row.status).toBe('NOTIFY_COUPON');
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'mobiline_application_id_missing' }));
  });
  it('does not overwrite a callback that arrives before the request response', async () => {
    const { service, client, row, telegram } = setup();
    client.activate.mockImplementation(async () => {
      await service.callback(callback);
      return { ret: 0, data: { application_id: 'APP' } };
    });
    await service.submit(9, row);
    expect(row).toMatchObject({ status: 'COMPLETED', iccid: 'ICCID', response: callback });
    expect(telegram.notifySimActivated).toHaveBeenCalledTimes(1);
  });
  it('applies simultaneous successful callbacks only once', async () => {
    const { service, row, telegram, socket } = setup('NOTIFY_COUPON');
    await Promise.all([service.callback(callback), service.callback(callback)]);
    expect(row).toMatchObject({
      status: 'COMPLETED',
      iccid: 'ICCID',
      cid: 'ICCID',
      qrcode: callback.data.qrcode,
      pin_1: '1234',
    });
    expect(telegram.notifySimActivated).toHaveBeenCalledTimes(1);
    expect(socket.sendOrderMessage).toHaveBeenCalledTimes(1);
    await service.callback({ ...callback, ret: '99' });
    expect(row.status).toBe('COMPLETED');
  });
  it('returns 422 without completing a SIM with missing QR', async () => {
    const { service, row, telegram } = setup('PENDING');
    await expect(service.callback({ ...callback, data: { ...callback.data, qrcode: '' } })).rejects.toMatchObject({
      status: 422,
    });
    expect(row.status).toBe('PENDING');
    expect(telegram.notifySimActivated).not.toHaveBeenCalled();
  });
  it('returns 404 for unknown correlation and constrains the provider lookup', async () => {
    const { service, prisma } = setup();
    prisma.sims.findFirst.mockResolvedValue(null);
    await expect(service.callback(callback)).rejects.toMatchObject({ status: 404 });
    expect(prisma.sims.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          channel_order_id: callback.channel_order_id,
          partner: { identified_number: 3 },
        },
      }),
    );
  });
  it('keeps completion when socket/notification fails', async () => {
    const { service, row, socket, events, telegram } = setup('PENDING');
    socket.sendOrderMessage.mockRejectedValue(new Error('offline'));
    await expect(service.callback(callback)).resolves.toEqual({ success: true });
    expect(row.status).toBe('COMPLETED');
    expect(telegram.notifySimActivated).toHaveBeenCalledTimes(1);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'mobiline_callback_post_processing_failed' }),
    );
  });
  it('acknowledges a callback refusal and records the failure', async () => {
    const { service, row, telegram } = setup('PENDING');
    await expect(service.callback({ ...callback, ret: '7', data: undefined })).resolves.toEqual({ success: true });
    expect(row.status).toBe('FAILED');
    expect(telegram.notifyOrderError).toHaveBeenCalledTimes(1);
  });
  it('lets persistence errors return 500 so the provider can retry', async () => {
    const { service, prisma } = setup('PENDING');
    prisma.sims.updateMany.mockRejectedValue(new Error('db unavailable'));
    await expect(service.callback(callback)).rejects.toThrow('db unavailable');
  });
  it('validates callback structure, accepts numeric ret zero and preserves nested fields', async () => {
    const dto = plainToInstance(MobilineCallbackDto, { ...callback, ret: 0 }, { enableImplicitConversion: true });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.ret).toBe('0');
    expect(dto.data?.cid).toBe('ICCID');
    expect((await validate(plainToInstance(MobilineCallbackDto, { ret: 0 }))).length).toBeGreaterThan(0);
  });
});
