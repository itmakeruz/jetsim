import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { hashSecret, parseKey, safeEqualHex } from '../keys/key-codec';

export interface ResellerPrincipal {
  id: number;
  name: string;
  status: 'ACTIVE' | 'BLOCKED';
  currency: string;
  keyId: number;
}

// Для неизвестного prefix сравниваем с «пустышкой», чтобы время ответа не выдавало существование ключа
const DUMMY_HASH = hashSecret('dummy-secret-for-constant-time');
const LAST_USED_THROTTLE_MS = 60_000;

/** Закупочные методы (`/b2b/*`): ключ конкретной компании. req.reseller — единственный источник company-контекста. */
@Injectable()
export class ResellerKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const parsed = parseKey(req.headers['x-reseller-key']);
    const unauthorized = () => new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    if (!parsed) throw unauthorized();

    const key = await this.prisma.resellerApiKey.findUnique({
      where: { prefix: parsed.prefix },
      include: { reseller: { select: { id: true, name: true, status: true, currency: true } } },
    });
    const ok = safeEqualHex(hashSecret(parsed.secret), key?.key_hash ?? DUMMY_HASH);
    if (!key || !ok || key.status !== 'ACTIVE') throw unauthorized();

    req.reseller = { id: key.reseller.id, name: key.reseller.name, status: key.reseller.status, currency: key.reseller.currency, keyId: key.id } as ResellerPrincipal;

    if (!key.last_used_at || Date.now() - key.last_used_at.getTime() > LAST_USED_THROTTLE_MS) {
      void this.prisma.resellerApiKey
        .update({ where: { id: key.id }, data: { last_used_at: new Date() } })
        .catch(() => undefined);
    }
    return true;
  }
}
