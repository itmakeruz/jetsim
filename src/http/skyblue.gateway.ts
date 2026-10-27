import { ProviderTrace, traceProviderError } from './provider-diagnostics';
import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { randomUUID } from 'crypto';
import { RedisService } from '../common/helpers/redis.helper';

@Injectable()
export class SkyBlueService {
  private readonly sessionKey = 'jetsim:skyblue:session';
  private readonly blockedKey = 'jetsim:skyblue:login_blocked';
  private readonly lockKey = 'jetsim:skyblue:login_lock';
  private readonly http = axios.create({
    baseURL: process.env.SKYBLUE_BASE_URI || 'https://skyblue.glocalnet.jp',
    timeout: 12000,
    maxRedirects: 0,
    validateStatus: () => true,
  });
  constructor(private readonly redis: RedisService) {}

  async getEsimDetail(iccid: string, trace?: ProviderTrace) {
    try {
      let session = (await this.redis.getClient().get(this.sessionKey)) || (await this.login(undefined, trace));
      let result = await this.detail(iccid, session, trace);
      if (result.errorCode === 'E9998') {
        session = await this.login(session, trace);
        result = await this.detail(iccid, session, trace);
        if (result.errorCode === 'E9998') {
          await this.block();
          throw new Error('Fresh session rejected');
        }
      }
      if (Number(result.result) !== 0 || !result.data || typeof result.data !== 'object')
        throw new Error('No usage detail');
      return result.data;
    } catch (error) {
      traceProviderError(trace, 'skyblue_error', '/ajax', { method: 'EsimGetOrderDetail', iccid }, error);
      // Axios errors contain the credentials/cookie in config: never propagate them.
      throw new Error('SkyBlue balance is temporarily unavailable');
    }
  }
  private async detail(iccid: string, session: string, trace?: ProviderTrace) {
    const response = await this.http.get('/ajax', {
      params: { method: 'EsimGetOrderDetail', order_number: '', iccid },
      headers: {
        'Accept': 'application/json, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `JSESSIONID=${session}`,
      },
    });
    trace?.({
      operation: 'skyblue_detail',
      endpoint: '/ajax',
      request: { method: 'EsimGetOrderDetail', iccid },
      http_status: response.status,
      response: response.data,
    });
    if (response.status >= 500 || response.status >= 400) throw new Error('SkyBlue HTTP error');
    if (response.status >= 300 || !response.data || typeof response.data !== 'object') return { errorCode: 'E9998' };
    return response.data;
  }
  private cookie(response: AxiosResponse): string | undefined {
    return response.headers['set-cookie']?.map((c) => c.match(/(?:^|;\s*)JSESSIONID=([^;]+)/i)?.[1]).find(Boolean);
  }
  private async block() {
    const client = this.redis.getClient();
    await client.set(this.blockedKey, '1', 'EX', 600);
    await client.del(this.sessionKey);
  }
  private async login(stale?: string, trace?: ProviderTrace): Promise<string> {
    const client = this.redis.getClient();
    const token = randomUUID();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await client.get(this.blockedKey)) throw new Error('SkyBlue login paused');
      const current = await client.get(this.sessionKey);
      if (current && current !== stale) return current;
      if (await client.set(this.lockKey, token, 'EX', 40, 'NX')) {
        try {
          if (await client.get(this.blockedKey)) throw new Error('SkyBlue login paused');
          const latest = await client.get(this.sessionKey);
          if (latest && latest !== stale) return latest;
          const email = process.env.SKYBLUE_EMAIL,
            password = process.env.SKYBLUE_PASSWORD;
          if (!email || !password) throw new Error('SkyBlue is not configured');
          const page = await this.http.get('/login.jsp');
          trace?.({ operation: 'skyblue_login_page', endpoint: '/login.jsp', http_status: page.status });
          if (page.status >= 400) throw new Error('SkyBlue login page unavailable');
          const cookie = this.cookie(page);
          const response = await this.http.post(
            '/action?method=login',
            new URLSearchParams({ inputEmail: email, inputPassword: password }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(cookie ? { Cookie: `JSESSIONID=${cookie}` } : {}),
              },
            },
          );
          trace?.({ operation: 'skyblue_login', endpoint: '/action?method=login', http_status: response.status });
          if (response.status >= 500) throw new Error('SkyBlue login unavailable');
          const session = this.cookie(response) || cookie;
          const rejected =
            String(response.headers.location ?? '').includes('login.jsp') ||
            (response.status < 300 && String(response.data).includes('form-signin'));
          if (response.status >= 400 || rejected || !session) {
            await this.block();
            throw new Error('SkyBlue login rejected');
          }
          await client.set(this.sessionKey, session, 'EX', 43200);
          return session;
        } finally {
          await client.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            this.lockKey,
            token,
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('SkyBlue login busy');
  }
}
