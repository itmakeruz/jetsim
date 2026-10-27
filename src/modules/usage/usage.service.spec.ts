import { UsageService } from './usage.service';

function setup(overrides: any = {}) {
  const sim = {
    id: 1,
    user_id: 5,
    status: 'COMPLETED',
    partner: { identified_number: 1 },
    coupon: 'PIN',
    tariff: { quantity_internet: 5, validity_period: 10 },
    ...overrides,
  };
  const prisma = { sims: { findFirst: jest.fn().mockResolvedValue(sim), update: jest.fn() } };
  const joytel = { getUsageResponse: jest.fn().mockResolvedValue({ code: '000', data: { totalUsage: 1073741824 } }) };
  const service = new UsageService(prisma as any, joytel as any, {} as any, {} as any);
  return { service, prisma, joytel, sim };
}
describe('UsageService access, caching and persistence', () => {
  it('checks ownership before returning cached data', async () => {
    const { service, prisma, joytel } = setup();
    prisma.sims.findFirst.mockResolvedValue(null);
    await expect(service.forSim(1, 99)).rejects.toMatchObject({ status: 404 });
    expect(prisma.sims.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, user_id: 99 } }));
    expect(joytel.getUsageResponse).not.toHaveBeenCalled();
  });
  it('uses successful snapshots for sixty seconds', async () => {
    const { service, joytel } = setup({ usage_snapshot: { used_mb: 512 }, usage_checked_at: new Date() });
    await expect(service.forSim(1, 5)).resolves.toMatchObject({ status: 'ok', data: { used_mb: 512 } });
    expect(joytel.getUsageResponse).not.toHaveBeenCalled();
  });
  it('refreshes stale snapshots and stores MB with an updated timestamp', async () => {
    const { service, prisma } = setup({ usage_snapshot: { used_mb: 512 }, usage_checked_at: new Date(0) });
    await expect(service.forSim(1, 5)).resolves.toMatchObject({ status: 'ok', data: { used_mb: 1024 } });
    expect(prisma.sims.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ last_usage_quantity: '1024', usage_checked_at: expect.any(Date) }),
      }),
    );
  });
  it('retains the last successful snapshot and hides upstream details on failure', async () => {
    const { service, prisma, joytel } = setup({ usage_snapshot: { used_mb: 512 } });
    joytel.getUsageResponse.mockRejectedValue(new Error('password=secret'));
    try {
      await service.forSim(1, 5);
      throw new Error('expected failure');
    } catch (error) {
      expect(error.getResponse()).toEqual({
        success: false,
        message: 'Balance is temporarily unavailable',
        last_success: { status: 'ok', data: { used_mb: 512 } },
      });
    }
    expect(prisma.sims.update).not.toHaveBeenCalled();
  });
  it('coalesces simultaneous refreshes of the same SIM', async () => {
    const { service, joytel } = setup();
    await Promise.all([service.forSim(1, 5), service.forSim(1)]);
    expect(joytel.getUsageResponse).toHaveBeenCalledTimes(1);
  });
  it.each(['PENDING', 'CREATED', 'NOTIFY_COUPON', 'FAILED'])('does not query an unissued SIM (%s)', async (status) => {
    const { service, joytel } = setup({ status });
    await expect(service.forSim(1)).resolves.toEqual({ status: 'not_ready' });
    expect(joytel.getUsageResponse).not.toHaveBeenCalled();
  });
  it('uses provider type rather than the partner row id', async () => {
    const { service } = setup({ partner_id: 45, partner: { identified_number: 1 } });
    await expect(service.forSim(1)).resolves.toMatchObject({ status: 'ok' });
  });
  it('returns unsupported for unknown integrations', async () => {
    const { service, joytel } = setup({ partner: { identified_number: 99 } });
    await expect(service.forSim(1)).resolves.toEqual({ status: 'unsupported' });
    expect(joytel.getUsageResponse).not.toHaveBeenCalled();
  });
});

describe('Admin-only provider diagnostics', () => {
  function failingCheck() {
    const prisma = {
      sims: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          status: 'COMPLETED',
          coupon: 'PRIVATE',
          partner: { identified_number: 1 },
          tariff: { quantity_internet: 5 },
        }),
        update: jest.fn(),
      },
    };
    const joytel = {
      getUsageResponse: jest.fn().mockImplementation(async (request, trace) => {
        const response = { code: '1002', msg: 'Coupon not found', secret: 'PRIVATE' };
        trace?.({ operation: 'joytel_usage', endpoint: '/esim/usage/query', request, response, http_status: 200 });
        return response;
      }),
    };
    return { service: new UsageService(prisma as any, joytel as any, {} as any, {} as any), joytel };
  }
  it('returns the sanitized supplier response and parsing reason to an admin', async () => {
    const { service } = failingCheck();
    try {
      await service.forSim(1, undefined, true);
      throw new Error('expected failure');
    } catch (error) {
      const body = error.getResponse();
      expect(body.diagnostics).toMatchObject({
        provider: 'Joytel',
        error: 'Joytel usage failed',
        exchanges: [
          {
            http_status: 200,
            request: { coupon: '[REDACTED]' },
            response: { code: '1002', msg: 'Coupon not found', secret: '[REDACTED]' },
          },
        ],
      });
      expect(JSON.stringify(body)).not.toContain('PRIVATE');
    }
  });
  it('does not expose diagnostics to a customer, including coalesced checks with an admin', async () => {
    const { service, joytel } = failingCheck();
    const results = await Promise.allSettled([service.forSim(1, 5), service.forSim(1, undefined, true)]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    const customer = (results[0] as PromiseRejectedResult).reason.getResponse();
    const admin = (results[1] as PromiseRejectedResult).reason.getResponse();
    expect(customer).not.toHaveProperty('diagnostics');
    expect(admin).toHaveProperty('diagnostics');
    expect(joytel.getUsageResponse).toHaveBeenCalledTimes(1);
  });
  it('returns diagnostic exchanges on successful normalization', async () => {
    const { service, joytel } = failingCheck();
    joytel.getUsageResponse.mockImplementation(async (request, trace) => {
      const response = { code: '000', data: { totalUsage: 1048576 } };
      trace?.({ operation: 'joytel_usage', request, response, http_status: 200 });
      return response;
    });
    await expect(service.forSim(1, undefined, true)).resolves.toMatchObject({
      status: 'ok',
      diagnostics: { exchanges: [{ response: { data: { totalUsage: 1048576 } } }] },
    });
    await expect(service.forSim(1, 5)).resolves.not.toHaveProperty('diagnostics');
  });
});
