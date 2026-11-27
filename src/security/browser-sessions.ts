import { Body, CallHandler, Controller, ExecutionContext, ForbiddenException, Global, Injectable, Module, NestInterceptor, Post, Req, Res, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { mergeMap } from 'rxjs/operators';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '@prisma';

const AUDIENCE = 'jetsim-browser';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const cookieNameFor = (req: any) => '__Host-jetsim-refresh-' + hash(String(req.headers.origin || '')).slice(0,12);
const allowedOrigins = () => (process.env.CORS_ORIGINS || 'https://jetsim.ru,https://admin.jetsim.ru').split(',').map(v => v.trim()).filter(Boolean);
export function assertBrowserOrigin(req: any) {
  if (!allowedOrigins().includes(req.headers.origin)) throw new ForbiddenException('Origin not allowed');
}
function cookie(req: any) {
  const cookieName = cookieNameFor(req);
  return (req.headers.cookie || '').split(';').map((v: string) => v.trim()).find((v: string) => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
}
function setCookie(req: any, res: any, value: string, ttl: number) {
  const cookieName = cookieNameFor(req);
  res.append('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`);
  res.setHeader('Cache-Control', 'no-store');
}
@Injectable()
export class BrowserSessions {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  private subject(p: any) { return p.type === 'staff' ? `staff:${p.id}` : p.uuid ? `client:${p.uuid}` : p.user_id ? `operator:${p.user_id}` : `user:${p.id ?? p.sub}`; }
  private async fingerprint(p: any): Promise<string> {
    const account = p.type === 'staff' ? await this.prisma.staff.findUnique({ where: { id: p.id } }) : await this.prisma.user.findUnique({ where: { id: p.id } });
    if (!account || (p.type === 'staff' && (account as any).status !== 'ACTIVE') || (account as any).is_service) throw new UnauthorizedException();
    return hash(String(account.password || '') + ':' + String((account as any).role || '') + ':' + String((account as any).status || ''));
  }
  private sign(claims: any, id: string) {
    const { exp, iat, nbf, aud, iss, jti, ...p } = claims;
    return this.jwt.sign({ ...p, sid: id, session_version: 2 }, { expiresIn: 900, audience: AUDIENCE });
  }
  async issue(claims: any, req: any, res: any) {
    assertBrowserOrigin(req);
    const id = randomUUID(), token = randomBytes(32).toString('hex');
    const ttl = claims.type === 'user' || claims.uuid ? 30 * 86400 : 7 * 86400;
    const fingerprint = await this.fingerprint(claims);
    const { exp, iat, ...payload } = claims;
    await this.prisma.$executeRaw`INSERT INTO browser_session (id, family, subject, refresh_hash, fingerprint, payload, expires_at) VALUES (${id}, ${id}, ${this.subject(claims)}, ${hash(token)}, ${fingerprint}, ${JSON.stringify(payload)}::jsonb, ${new Date(Date.now() + ttl * 1000)})`;
    setCookie(req, res, token, ttl);
    return this.sign(claims, id);
  }
  async validate(p: any) {
    if (p.session_version !== 2 || p.aud !== AUDIENCE || typeof p.sid !== 'string') throw new UnauthorizedException();
    const rows: any[] = await this.prisma.$queryRaw`SELECT active_session.* FROM browser_session original
      JOIN browser_session active_session ON active_session.family=original.family
      WHERE original.id=${p.sid} AND active_session.revoked=false AND active_session.expires_at>now()`;
    const row = rows[0];
    if (!row || row.subject !== this.subject(p) || row.fingerprint !== await this.fingerprint(p)) throw new UnauthorizedException();
  }
  async refresh(req: any, res: any) {
    assertBrowserOrigin(req);
    const token = cookie(req);
    if (!/^[a-f0-9]{64}$/.test(token || '')) throw new UnauthorizedException();
    const result: any = await this.prisma.$transaction(async tx => {
      const rows: any[] = await tx.$queryRaw`SELECT * FROM browser_session WHERE refresh_hash=${hash(token)} FOR UPDATE`;
      const old = rows[0];
      if (!old) return null;
      if (old.revoked) {
        await tx.$executeRaw`UPDATE browser_session SET revoked=true WHERE family=${old.family}`;
        return null;
      }
      if (new Date(old.expires_at).getTime() <= Date.now() || old.fingerprint !== await this.fingerprint(old.payload)) {
        await tx.$executeRaw`UPDATE browser_session SET revoked=true WHERE family=${old.family}`;
        return null;
      }
      const id = randomUUID(), next = randomBytes(32).toString('hex');
      await tx.$executeRaw`UPDATE browser_session SET revoked=true WHERE id=${old.id}`;
      await tx.$executeRaw`INSERT INTO browser_session (id,family,subject,refresh_hash,fingerprint,payload,expires_at) VALUES (${id},${old.family},${old.subject},${hash(next)},${old.fingerprint},${JSON.stringify(old.payload)}::jsonb,${old.expires_at})`;
      return { id, next, payload: old.payload, expiry: old.expires_at };
    });
    if (!result) { setCookie(req, res, '', 0); throw new UnauthorizedException(); }
    setCookie(req, res, result.next, Math.max(0, Math.floor((new Date(result.expiry).getTime()-Date.now())/1000)));
    return { access_token: this.sign(result.payload, result.id), expires_in: 900 };
  }
  async logout(req: any, res: any) {
    assertBrowserOrigin(req);
    const token = cookie(req);
    if (token) await this.prisma.$executeRaw`UPDATE browser_session SET revoked=true WHERE family IN (SELECT family FROM browser_session WHERE refresh_hash=${hash(token)})`;
    setCookie(req, res, '', 0);
    return { success: true };
  }
}
@Injectable()
class SessionResponseInterceptor implements NestInterceptor {
  constructor(private readonly sessions: BrowserSessions, private readonly jwt: JwtService) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest(), res = ctx.switchToHttp().getResponse();
    return next.handle().pipe(mergeMap(async body => {
      // Only login responses may mint sessions; refresh already returns a versioned access token.
      const target = body?.data?.access_token ? body.data : body?.access_token ? body : null;
      if (target && /\/auth\/(login|confirm-email)$/.test(req.path)) {
        const p: any = this.jwt.verify(target.access_token);
        if (p.session_version !== 2) target.access_token = await this.sessions.issue(p, req, res);
        target.expires_in = 900;
      }
      return body;
    }));
  }
}
@Controller('auth')
class BrowserSessionController {
  constructor(private readonly sessions: BrowserSessions) {}
  @Post('refresh') refresh(@Req() req: any, @Res({ passthrough: true }) res: any) { return this.sessions.refresh(req, res); }
  @Post('logout') logout(@Req() req: any, @Res({ passthrough: true }) res: any) { return this.sessions.logout(req, res); }
}
@Global()
@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_ACCESS_SECRET }) })],
  providers: [BrowserSessions, { provide: APP_INTERCEPTOR, useClass: SessionResponseInterceptor }],
  controllers: [BrowserSessionController], exports: [BrowserSessions],
})
export class BrowserSecurityModule {}
