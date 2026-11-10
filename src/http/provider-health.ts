import type { AxiosInstance } from 'axios';
type Sample = { at: number; status: number; duration_ms: number };
const samples = new Map<string, Sample[]>();
export function observeProvider(name: string, start: number, status: number) {
  const now = Date.now();
  samples.set(name, [...(samples.get(name) ?? []).filter(s => now - s.at < 3600000), { at: now, status, duration_ms: Math.max(0, now - start) }].slice(-200));
}
export function providerHealth(now = Date.now()) {
  return ['Joytel', 'BillionConnect', 'Mobiline'].map(provider => {
    const rows = (samples.get(provider) ?? []).filter(r => now - r.at < 3600000);
    const last = rows[rows.length - 1];
    return { provider, scope: 'current_process', last_request_at: last ? new Date(last.at) : null, last_http_status: last?.status ?? null, last_duration_ms: last?.duration_ms ?? null, availability: !last || now - last.at > 300000 ? 'unknown' : last.status >= 200 && last.status < 500 ? 'responding' : 'error', requests_1h: rows.length, transport_errors_1h: rows.filter(r => !r.status || r.status >= 500).length };
  });
}
/** Только метаданные HTTP; URL, секреты, запросы и ответы сюда не попадают. */
export function instrumentProvider(http: AxiosInstance, name: string) {
  if (!http.interceptors) return;
  http.interceptors.request.use(config => { (config as any).__healthStart = Date.now(); return config; });
  http.interceptors.response.use(response => { observeProvider(name, (response.config as any).__healthStart ?? Date.now(), response.status); return response; }, error => { observeProvider(name, error.config?.__healthStart ?? Date.now(), error.response?.status ?? 0); return Promise.reject(error); });
}
