import { catchError, mergeMap, tap } from 'rxjs/operators';
import { from, throwError } from 'rxjs';
import { CallHandler, NestInterceptor, CanActivate, ExecutionContext, Global, HttpException, Injectable, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import Redis from 'ioredis';
import { createHash } from 'crypto';
@Injectable()
export class SecurityLimits implements CanActivate, NestInterceptor {
  private readonly redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379), password: process.env.REDIS_PASSWORD || undefined, enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: true });
  constructor() { this.redis.on('error', () => {}); this.redis.connect().catch(() => {}); }
  async onModuleDestroy() { this.redis.disconnect(); }
  async hit(key: string, limit: number, seconds: number, res?: any) {
    try {
      const result = await this.redis.eval(`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}`, 1,
        'jetsim:security:' + createHash('sha256').update(key).digest('hex'), seconds) as number[];
      if (result[0] > limit) {
        res?.setHeader('Retry-After', Math.max(1, result[1]));
        throw new HttpException('Too many attempts. Try again later.', 429);
      }
    } catch (e) { if (e instanceof HttpException) throw e; throw new ServiceUnavailableException('Authentication temporarily unavailable'); }
  }
  private async checkLogin(key: string, limit: number, res: any) {
    try {
      const result=await this.redis.eval(`local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return {0,redis.call('TTL',KEYS[1])} end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return {1,900}`,1,key,limit) as number[];
      if (!result[0]) { res.setHeader('Retry-After',Math.max(1,result[1])); throw new HttpException('Too many attempts. Try again later.',429); }
    } catch(e) { if (e instanceof HttpException) throw e; throw new ServiceUnavailableException('Authentication temporarily unavailable'); }
  }
  private loginKeys(req: any) {
    const account=String(req.body?.email || req.body?.login || '').trim().toLowerCase();
    const ip=req.ip || req.socket?.remoteAddress || '-';
    return ['login:account:'+account,'login:ip:'+ip].map(k=>'jetsim:security:'+createHash('sha256').update(k).digest('hex'));
  }
  intercept(ctx: ExecutionContext, next: CallHandler) {
    if(ctx.getType()!=='http') return next.handle();
    const req=ctx.switchToHttp().getRequest();
    if(req.method!=='POST' || !/\/auth\/login$/.test(req.path)) return next.handle();
    return next.handle().pipe(mergeMap(async body=>{ await this.releaseLogin(req); return body; }),catchError(error=> {
      if ([400,401,403,404].includes(error.status)) return throwError(()=>error);
      return from(this.releaseLogin(req)).pipe(mergeMap(()=>throwError(()=>error)));
    }));
  }
  private async releaseLogin(req: any) {
    try {
      for(const key of this.loginKeys(req)) await this.redis.eval(`local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>0 then redis.call('DECR',KEYS[1]) end; return 1`,1,key);
    } catch { throw new ServiceUnavailableException('Authentication temporarily unavailable'); }
  }
  async canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest(), res = ctx.switchToHttp().getResponse();
    if (req.method !== 'POST' || !req.path.startsWith('/auth/')) return true;
    const account = String(req.body?.email || req.body?.login || '').trim().toLowerCase();
    const ip = req.ip || req.socket?.remoteAddress || '-';
    if (/\/(send-otp|forgot-password\/prepare)$/.test(req.path)) {
      await this.hit('otp:cooldown:' + account, 1, 60, res);
      await this.hit('otp:address:' + account, 5, 3600, res);
      await this.hit('otp:ip:' + ip, 20, 3600, res);
      await this.hit('otp:service-budget', 200, 3600, res);
    } else if (/\/login$/.test(req.path)) {
      const [accountKey,ipKey]=this.loginKeys(req);
      await this.checkLogin(accountKey,5,res);
      await this.checkLogin(ipKey,30,res);
    }
    return true;
  }
}
@Global()
@Module({ providers: [SecurityLimits, { provide: APP_GUARD, useExisting: SecurityLimits }, { provide: APP_INTERCEPTOR, useExisting: SecurityLimits }], exports: [SecurityLimits] })
export class SecurityLimitsModule {}
