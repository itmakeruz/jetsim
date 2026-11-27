import { createHash } from 'crypto';
import { BrowserSessions, assertBrowserOrigin } from './browser-sessions';
const origin = 'https://security-test.example';
describe('browser sessions', () => {
  beforeEach(() => { process.env.CORS_ORIGINS = origin; });
  const req = (token?: string) => ({ headers: { origin, cookie: token ? `__Host-jetsim-refresh-${createHash('sha256').update(origin).digest('hex').slice(0,12)}=${token}` : '' } });
  const res = () => ({ append: jest.fn(), setHeader: jest.fn() });
  function setup() {
    const rows: any[] = [];
    const execute = jest.fn(async (sql: TemplateStringsArray, ...v: any[]) => {
      if (sql.join('').startsWith('INSERT')) rows.push({ id:v[0], family:v[1], subject:v[2], refresh_hash:v[3], fingerprint:v[4], payload:JSON.parse(v[5]), expires_at:v[6], revoked:false });
      else if (sql.join('').includes('WHERE id=')) rows.filter(r=>r.id===v[0]).forEach(r=>r.revoked=true);
      else rows.filter(r=>r.family===v[0]).forEach(r=>r.revoked=true);
      return 1;
    });
    const query = jest.fn(async (sql: TemplateStringsArray,...v:any[])=> rows.filter(r=>sql.join('').includes('refresh_hash=')? r.refresh_hash===v[0] : r.family===rows.find(original=>original.id===v[0])?.family && !r.revoked));
    const db:any={ $executeRaw:execute, $queryRaw:query, $transaction:async (fn:any)=>fn(db) };
    const jwt:any={sign:jest.fn((p:any)=>JSON.stringify(p))};
    const service=new BrowserSessions(db,jwt);
    let fingerprint='credential-version-1';
    jest.spyOn(service as any,'fingerprint').mockImplementation(async()=>fingerprint);
    return {service,rows,jwt,changePassword:()=>{fingerprint='credential-version-2';}};
  }
  it('rejects legacy access tokens and untrusted origins',async()=>{
    const {service}=setup();
    await expect(service.validate({ id:1 })).rejects.toMatchObject({status:401});
    expect(()=>assertBrowserOrigin({headers:{origin:'https://attacker.example'}})).toThrow();
  });
  it('keeps only a hash of refresh token and sets protected cookie',async()=>{
    const {service,rows,jwt}=setup(), response=res();
    await service.issue({id:1,type:'user'},req(),response);
    const value=response.append.mock.calls[0][1];
    const raw=value.split('=')[1].split(';')[0];
    expect(rows[0].refresh_hash).not.toBe(raw);
    expect(rows[0].refresh_hash).toHaveLength(64);
    expect(value).toContain('HttpOnly; Secure; SameSite=Lax');
    expect(jwt.sign.mock.calls[0][1].expiresIn).toBe(900);
  });
  it('rotates refresh tokens and revokes family on reuse',async()=>{
    const {service,rows}=setup(), response=res();
    await service.issue({id:1,type:'user'},req(),response);
    const raw=response.append.mock.calls[0][1].split('=')[1].split(';')[0];
    await service.refresh(req(raw),res());
    expect(rows).toHaveLength(2);
    expect(rows[0].revoked).toBe(true);
    await expect(service.refresh(req(raw),res())).rejects.toMatchObject({status:401});
    expect(rows.every(r=>r.revoked)).toBe(true);
  });
  it('password change invalidates outstanding refresh tokens',async()=>{
    const {service,changePassword}=setup(), response=res();
    await service.issue({id:1,type:'user'},req(),response);
    const raw=response.append.mock.calls[0][1].split('=')[1].split(';')[0];
    changePassword();
    await expect(service.refresh(req(raw),res())).rejects.toMatchObject({status:401});
  });
});
