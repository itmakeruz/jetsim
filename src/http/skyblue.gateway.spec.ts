import { SkyBlueService } from './skyblue.gateway';

function setup(cached: string | null = 'OLD') {
  const store = new Map<string, string>();
  if (cached) store.set('jetsim:skyblue:session', cached);
  const client = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, _ex: string, _ttl: number, nx?: string) => {
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => store.delete(key)),
    eval: jest.fn(async () => store.delete('jetsim:skyblue:login_lock')),
  };
  const service = new SkyBlueService({ getClient: () => client } as any);
  const http = { get: jest.fn(), post: jest.fn() };
  (service as any).http = http;
  return { service, store, client, http };
}
const response = (data: any, status = 200, headers: any = {}) => ({ data, status, headers });
describe('SkyBlue sessions', () => {
  beforeEach(() => {
    process.env.SKYBLUE_EMAIL = 'account@test.invalid';
    process.env.SKYBLUE_PASSWORD = 'PRIVATE';
  });
  afterEach(() => {
    delete process.env.SKYBLUE_EMAIL;
    delete process.env.SKYBLUE_PASSWORD;
  });
  it('uses the cached session without logging in', async () => {
    const { service, http } = setup('CACHED');
    http.get.mockResolvedValue(response({ result: 0, data: { ICCID: 'CID' } }));
    await expect(service.getEsimDetail('CID')).resolves.toEqual({ ICCID: 'CID' });
    expect(http.get).toHaveBeenCalledWith(
      '/ajax',
      expect.objectContaining({ headers: expect.objectContaining({ Cookie: 'JSESSIONID=CACHED' }) }),
    );
    expect(http.post).not.toHaveBeenCalled();
  });
  it('relogs in once on E9998 and caches a rotated cookie', async () => {
    const { service, http, store } = setup();
    http.get
      .mockResolvedValueOnce(response({ result: -1, errorCode: 'E9998' }))
      .mockResolvedValueOnce(response('', 200, { 'set-cookie': ['JSESSIONID=PAGE; Path=/'] }))
      .mockResolvedValueOnce(response({ result: 0, data: { ICCID: 'CID' } }));
    http.post.mockResolvedValue(
      response('', 302, { 'location': '/index.jsp', 'set-cookie': ['JSESSIONID=NEW; Path=/'] }),
    );
    await expect(service.getEsimDetail('CID')).resolves.toEqual({ ICCID: 'CID' });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(store.get('jetsim:skyblue:session')).toBe('NEW');
  });
  it('does not relogin or block on E1000 for an inaccessible ICCID', async () => {
    const { service, http, store } = setup();
    http.get.mockResolvedValue(response({ result: -1, errorCode: 'E1000' }));
    await expect(service.getEsimDetail('BAD')).rejects.toThrow('temporarily unavailable');
    expect(http.post).not.toHaveBeenCalled();
    expect(store.has('jetsim:skyblue:login_blocked')).toBe(false);
    expect(store.get('jetsim:skyblue:session')).toBe('OLD');
  });
  it('pauses logins for ten minutes after credentials are rejected', async () => {
    const { service, http, client } = setup(null);
    http.get.mockResolvedValue(response('', 200, { 'set-cookie': ['JSESSIONID=PAGE; Path=/'] }));
    http.post.mockResolvedValue(response('', 302, { location: '/login.jsp' }));
    await expect(service.getEsimDetail('CID')).rejects.toThrow('temporarily unavailable');
    expect(client.set).toHaveBeenCalledWith('jetsim:skyblue:login_blocked', '1', 'EX', 600);
    await expect(service.getEsimDetail('CID')).rejects.toThrow('temporarily unavailable');
    expect(http.post).toHaveBeenCalledTimes(1);
  });
  it('does not pause logins during a portal outage', async () => {
    const { service, http, store } = setup(null);
    http.get.mockResolvedValue(response('', 200));
    http.post.mockResolvedValue(response('outage', 503));
    await expect(service.getEsimDetail('CID')).rejects.toThrow('temporarily unavailable');
    expect(store.has('jetsim:skyblue:login_blocked')).toBe(false);
  });
  it('blocks a fresh session rejected again by the portal', async () => {
    const { service, http, store } = setup();
    http.get
      .mockResolvedValueOnce(response({ result: -1, errorCode: 'E9998' }))
      .mockResolvedValueOnce(response('', 200, { 'set-cookie': ['JSESSIONID=PAGE; Path=/'] }))
      .mockResolvedValueOnce(response({ result: -1, errorCode: 'E9998' }));
    http.post.mockResolvedValue(response('', 302, { 'location': '/', 'set-cookie': ['JSESSIONID=NEW; Path=/'] }));
    await expect(service.getEsimDetail('CID')).rejects.toThrow();
    expect(store.has('jetsim:skyblue:login_blocked')).toBe(true);
    expect(http.post).toHaveBeenCalledTimes(1);
  });
  it('serializes simultaneous login requests', async () => {
    const { service, http } = setup(null);
    http.get.mockImplementation(async (url: string) =>
      url === '/login.jsp'
        ? response('', 200, { 'set-cookie': ['JSESSIONID=PAGE; Path=/'] })
        : response({ result: 0, data: { ICCID: 'CID' } }),
    );
    http.post.mockResolvedValue(response('', 302, { 'location': '/', 'set-cookie': ['JSESSIONID=NEW; Path=/'] }));
    await Promise.all([service.getEsimDetail('CID'), service.getEsimDetail('CID')]);
    expect(http.post).toHaveBeenCalledTimes(1);
  });
});
