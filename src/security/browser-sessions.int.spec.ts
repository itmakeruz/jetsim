import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { BrowserSessions } from './browser-sessions';
import { randomUUID } from 'crypto';
const url=process.env.SECURITY_TEST_DATABASE_URL;
const suite=url?describe:describe.skip;
const origin='https://session-test.example';
suite('session SQL integration (isolated DB only)',()=>{
 let db:PrismaClient, service:BrowserSessions, subject:string;
 const jwt=new JwtService({secret:'isolated-security-tests-only'});
 const request=(token?:string)=>({headers:{origin,cookie:token?`__Host-jetsim-refresh-${createHash('sha256').update(origin).digest('hex').slice(0,12)}=${token}`:''}});
 const response=()=>({append:jest.fn(),setHeader:jest.fn()});
 beforeAll(()=>{
  if(!url || !/_test(?:\?|$)/.test(url)) throw new Error('Use a dedicated *_test database');
  process.env.CORS_ORIGINS=origin;
  db=new PrismaClient({datasources:{db:{url}}});
  service=new BrowserSessions(db as any,jwt);
  jest.spyOn(service as any,'fingerprint').mockResolvedValue('test-credential-version');
 });
 beforeEach(()=>{subject=randomUUID();});
 afterEach(async()=>{await db.$executeRaw`DELETE FROM browser_session WHERE subject=${'user:'+subject}`;});
 afterAll(async()=>{await db?.$disconnect();});
 async function issue(){
  const res=response();
  const access=await service.issue({id:subject,type:'user'},request(),res);
  return {access,refresh:res.append.mock.calls[0][1].split('=')[1].split(';')[0]};
 }
 it('validates owner and audience and revokes on logout',async()=>{
  const issued=await issue(),p:any=jwt.decode(issued.access);
  await expect(service.validate(p)).resolves.toBeUndefined();
  await expect(service.validate({...p,id:'other'})).rejects.toMatchObject({status:401});
  await expect(service.validate({...p,aud:'other'})).rejects.toMatchObject({status:401});
  await service.logout(request(issued.refresh),response());
  await expect(service.validate(p)).rejects.toMatchObject({status:401});
 });
 it('serializes parallel refresh and detects replay without leaving an active child',async()=>{
  const issued=await issue();
  const results=await Promise.allSettled([service.refresh(request(issued.refresh),response()),service.refresh(request(issued.refresh),response())]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  const rows:any[]=await db.$queryRaw`SELECT * FROM browser_session WHERE subject=${'user:'+subject}`;
  expect(rows).toHaveLength(2);
  expect(rows.every(r=>r.revoked)).toBe(true);
 });
 it('keeps an existing access token valid through rotation, then revokes the family on logout',async()=>{
  const issued=await issue(), res=response();
  await service.refresh(request(issued.refresh),res);
  await expect(service.validate(jwt.decode(issued.access))).resolves.toBeUndefined();
  const rotated=res.append.mock.calls[0][1].split('=')[1].split(';')[0];
  await service.logout(request(rotated),response());
  await expect(service.validate(jwt.decode(issued.access))).rejects.toMatchObject({status:401});
 });
 it('does not refresh or accept expired sessions',async()=>{
  const issued=await issue();
  await db.$executeRaw`UPDATE browser_session SET expires_at=now()-interval '1 second' WHERE subject=${'user:'+subject}`;
  await expect(service.validate(jwt.decode(issued.access))).rejects.toMatchObject({status:401});
  await expect(service.refresh(request(issued.refresh),response())).rejects.toMatchObject({status:401});
 });
});
