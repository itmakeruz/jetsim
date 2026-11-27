const secretKey = /password|secret|token|otp|(?:^|_)cid(?:$|_)|authorization|cookie|api.?key|group.?key|qr.?code|activation|coupon|(?:^|_)pin|(?:^|_)puk|sn_code|iccid/i;
export function redact(value: unknown, seen = new WeakSet<object>()): any {
  if (typeof value === 'string') {
    if (/^\s*[\[{]/.test(value)) { try { return JSON.stringify(redact(JSON.parse(value), seen)); } catch {} }
    let sanitized = value;
    for (const [key, secret] of Object.entries(process.env)) {
      if (/SECRET|TOKEN|PASSWORD|PASS$|API_KEY|GROUP_KEY/.test(key) && secret && secret.length >= 8) sanitized = sanitized.split(secret).join('[REDACTED]');
    }
    return sanitized.replace(/(api\.telegram\.org\/(?:file\/)?bot)[^/\s]+/gi, '$1[REDACTED]').replace(/LPA:[^\s"'<>]+/gi, '[REDACTED]').replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [REDACTED]')
      .replace(/([?&](?:token|key|secret|code|pin|puk|qrcode)[^=\s]*=)[^&\s]*/gi,'$1[REDACTED]');
  }
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, code: (value as any).code, status: (value as any).status };
  if (Buffer.isBuffer(value)) return '[BINARY]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redact(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,secretKey.test(key)?'[REDACTED]':redact(item, seen)]));
}
