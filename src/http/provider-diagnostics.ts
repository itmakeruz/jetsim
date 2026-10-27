/** Per-request diagnostics. Never capture HTTP headers or Axios request configs. */
export interface ProviderExchange {
  operation: string;
  endpoint?: string;
  request?: unknown;
  response?: unknown;
  http_status?: number;
  error?: string;
}
export type ProviderTrace = (exchange: ProviderExchange) => void;

export function sanitizeProviderData(value: unknown, depth = 0): any {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/^\s*</.test(value)) return '[HTML response omitted]';
    if (/^\s*[\[{]/.test(value)) {
      try {
        return sanitizeProviderData(JSON.parse(value), depth + 1);
      } catch {
        /* Non-JSON text is handled below. */
      }
    }
    let text = value;
    for (const [key, secret] of Object.entries(process.env)) {
      if (
        /password|secret|token|group_key|app_key|skyblue_email|database_url|redis_url/i.test(key) &&
        secret &&
        secret.length >= 3
      ) {
        text = text.split(secret).join('[REDACTED]');
      }
    }
    text = text.replace(
      /((?:password|secret|token|cookie|jsessionid|authorization|group[-_]key)\s*[=:]\s*)[^\s,;&]+/gi,
      '$1[REDACTED]',
    );
    text = text.replace(/(\w+:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1[REDACTED]@');
    return text.length > 4000 ? text.slice(0, 4000) + '…[TRUNCATED]' : text;
  }
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeProviderData(item, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, data] of Object.entries(value).slice(0, 100)) {
      result[key] =
        /password|secret|token|cookie|jsessionid|authorization|key|ciphertext|autograph|sign|coupon|sn_?pin|qr_?code|email|phone|imsi|imei|customer|device|^pin|^puk/i.test(
          key,
        )
          ? '[REDACTED]'
          : sanitizeProviderData(data, depth + 1);
    }
    return result;
  }
  return '[OMITTED]';
}

export function traceProviderError(
  trace: ProviderTrace | undefined,
  operation: string,
  endpoint: string,
  request: unknown,
  error: any,
) {
  trace?.({
    operation,
    endpoint,
    request,
    http_status: error?.response?.status,
    response: error?.response?.data,
    error: error?.code || error?.message || 'Request failed',
  });
}
