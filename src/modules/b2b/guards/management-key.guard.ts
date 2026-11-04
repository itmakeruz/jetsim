import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { safeEqualHex } from '../keys/key-codec';

/**
 * Управляющие методы (`/b2b-admin/*`): ключ есть только у нашей инфраструктуры
 * (партнёрский backend). Без настроенного B2B_MANAGEMENT_KEY_HASH методы закрыты
 * полностью (fail-closed). Закупочный ключ компании сюда не подходит.
 *
 * B2B_MANAGEMENT_KEY_HASH — sha256(hex) управляющего ключа;
 * B2B_MANAGEMENT_ALLOWED_IPS — необязательный список IP через запятую.
 */
@Injectable()
export class ManagementKeyGuard implements CanActivate {
  private readonly logger = new Logger(ManagementKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const expected = (this.config.get<string>('B2B_MANAGEMENT_KEY_HASH') ?? '').trim().toLowerCase();
    if (!expected) {
      this.logger.error('B2B_MANAGEMENT_KEY_HASH не задан — управляющее B2B API закрыто');
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }

    const provided = req.headers['x-management-key'];
    const providedHash =
      typeof provided === 'string' ? crypto.createHash('sha256').update(provided).digest('hex') : '';
    if (!safeEqualHex(providedHash, expected)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }

    const allowed = (this.config.get<string>('B2B_MANAGEMENT_ALLOWED_IPS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length > 0) {
      const ip = String(req.ip ?? req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
      if (!allowed.includes(ip)) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }

    // Кто именно из сотрудников инициировал операцию (для журнала); значение даёт наш партнёрский backend
    const actor = req.headers['x-actor'];
    req.actor = typeof actor === 'string' ? actor.replace(/[^\x20-\x7E]/g, '').slice(0, 128) || null : null;
    return true;
  }
}
