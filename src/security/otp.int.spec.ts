import { RedisService } from '../common/helpers/redis.helper';
import { SecurityLimits } from './rate-limit';
import { randomUUID } from 'crypto';
const suite=process.env.SECURITY_REDIS_TEST==='true'?describe:describe.skip;
async function ready(client:any){
 if(client.status==='ready') return;
 await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Isolated Redis not ready')),3000);
  client.once('ready',()=>{clearTimeout(timer);resolve();});
 });
}
suite('OTP and login concurrency (isolated Redis)',()=>{
 let otp:RedisService;
 beforeAll(async()=>{otp=new RedisService();await ready(otp.getClient());});
 afterAll(async()=>{await otp?.onModuleDestroy();});
 it('consumes a code once under concurrent valid submissions',async()=>{
  const key='security-test:'+randomUUID();await otp.setOtp(key,'123456',20);
  const result=await Promise.all(Array.from({length:12},()=>otp.consumeOtp(key,'123456')));
  expect(result.filter(Boolean)).toHaveLength(1);
 });
 it('limits guesses per challenge and resets attempts for a newly issued code',async()=>{
  const key='security-test:'+randomUUID();await otp.setOtp(key,'123456',20);
  for(let i=0;i<5;i++)expect(await otp.consumeOtp(key,'000000')).toBe(false);
  expect(await otp.consumeOtp(key,'123456')).toBe(false);
  await otp.setOtp(key,'654321',20);
  expect(await otp.consumeOtp(key,'654321')).toBe(true);
 });
 it('bounds concurrent login attempts and preserves locks across service instances',async()=>{
  const first=new SecurityLimits(), second=new SecurityLimits();
  await Promise.all([ready((first as any).redis),ready((second as any).redis)]);
  const req={method:'POST',path:'/auth/login',body:{email:randomUUID()+'@example.invalid'},ip:randomUUID()};
  const res={setHeader:jest.fn()};
  const ctx:any={getType:()=> 'http',switchToHttp:()=>({getRequest:()=>req,getResponse:()=>res})};
  try {
   const result=await Promise.allSettled(Array.from({length:12},()=>first.canActivate(ctx)));
   expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(5);
   await expect(second.canActivate(ctx)).rejects.toMatchObject({status:429});
   expect(res.setHeader).toHaveBeenCalledWith('Retry-After',expect.any(Number));
   for(const key of (first as any).loginKeys(req)) await (first as any).redis.del(key);
  } finally {await first.onModuleDestroy();await second.onModuleDestroy();}
 });
});
