import * as crypto from 'crypto';

/**
 * Формат закупочного ключа компании: `jrk_<prefix>_<secret>`.
 * prefix (8 hex) — публичный идентификатор для поиска записи, не секрет;
 * secret (32 байта, base64url) — показывается один раз, в БД только sha256.
 */
const KEY_RE = /^jrk_([0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;

export function generateKey(): { key: string; prefix: string; hash: string } {
  const prefix = crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  return { key: `jrk_${prefix}_${secret}`, prefix, hash: hashSecret(secret) };
}

export function parseKey(raw: unknown): { prefix: string; secret: string } | null {
  if (typeof raw !== 'string') return null;
  const m = KEY_RE.exec(raw.trim());
  return m ? { prefix: m[1], secret: m[2] } : null;
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Сравнение хешей за постоянное время */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}
