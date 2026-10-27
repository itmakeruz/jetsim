import { sanitizeProviderData, traceProviderError } from './provider-diagnostics';

describe('Provider diagnostic redaction', () => {
  it('retains counters and error codes while hiding credentials and personal data recursively', () => {
    const result = sanitizeProviderData({
      code: '1002',
      msg: 'Coupon not found',
      totalUsage: 1024,
      request: {
        coupon: 'PRIVATE',
        iccid: '898123',
        headers: { 'Authorization': 'Bearer PRIVATE', 'group-key': 'PRIVATE' },
      },
      data: [
        { email: 'private@example.com', JSESSIONID: 'PRIVATE', qrcode: 'PRIVATE', pin1: 'PRIVATE', used_quota: 1024 },
      ],
    });
    expect(result).toMatchObject({
      code: '1002',
      msg: 'Coupon not found',
      totalUsage: 1024,
      request: { coupon: '[REDACTED]', iccid: '898123' },
      data: [{ used_quota: 1024 }],
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });
  it('redacts configured secrets even inside error strings', () => {
    process.env.SKYBLUE_PASSWORD = 'test-super-private';
    try {
      expect(sanitizeProviderData('Failed: test-super-private')).toBe('Failed: [REDACTED]');
    } finally {
      delete process.env.SKYBLUE_PASSWORD;
    }
  });
  it('omits HTML pages that may contain customer or login details', () => {
    expect(sanitizeProviderData('<html><input value="PRIVATE"></html>')).toBe('[HTML response omitted]');
  });
  it('captures HTTP failures without copying request configs or cookies', () => {
    const trace = jest.fn();
    traceProviderError(
      trace,
      'usage',
      '/usage',
      { iccid: '898123' },
      {
        code: 'ERR_BAD_RESPONSE',
        config: { password: 'PRIVATE' },
        response: { status: 503, data: { error: 'Service unavailable' }, headers: { 'set-cookie': 'PRIVATE' } },
      },
    );
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        http_status: 503,
        response: { error: 'Service unavailable' },
        error: 'ERR_BAD_RESPONSE',
      }),
    );
    expect(JSON.stringify(trace.mock.calls)).not.toContain('PRIVATE');
  });
});
