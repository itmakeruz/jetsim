import { observeProvider, providerHealth } from './provider-health';
describe('Provider HTTP observations', () => {
  it('does not report availability without a recent response', () => {
    expect(providerHealth().find(p => p.provider === 'Mobiline')?.availability).toBe('unknown');
  });
  it('records only transport metadata and expires the availability signal', () => {
    const now = Date.now();
    observeProvider('Mobiline', now - 20, 200);
    const observed = providerHealth(now).find(p => p.provider === 'Mobiline')!;
    expect(observed).toMatchObject({ availability: 'responding', last_http_status: 200, requests_1h: 1, transport_errors_1h: 0 });
    expect(providerHealth(now + 301000).find(p => p.provider === 'Mobiline')?.availability).toBe('unknown');
    expect(providerHealth(now + 3600001).find(p => p.provider === 'Mobiline')?.requests_1h).toBe(0);
  });
  it('counts HTTP 5xx as a transport error', () => {
    observeProvider('Joytel', Date.now(), 503);
    expect(providerHealth().find(p => p.provider === 'Joytel')).toMatchObject({ availability: 'error', transport_errors_1h: 1 });
  });
});
