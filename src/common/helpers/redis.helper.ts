import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_OTP_PREFIX } from '@config';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: REDIS_HOST,
      enableOfflineQueue: false, maxRetriesPerRequest: 1,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000); // 50ms dan 2000ms gacha qayta urinish
      },
    });

    this.client.on('connect', () => {
      console.log('Redis client successfully connected!');
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
  }

  // Modul ishga tushganda ulanish holatini tekshirish
  // async onModuleInit() {
  //   // `connect()` chaqirishni olib tashladik, chunki ulanish avtomatik boshlanadi
  //   if (this.client.status === 'ready') {
  //     console.log('Redis allaqachon ulangan!');
  //   } else if (this.client.status === 'connecting') {
  //     console.log('Redis ulanish jarayonida...');
  //   }
  // }

  async onModuleDestroy() {
    await this.client.quit();
    console.log('Redis disconnected!');
  }

  async setOtp(key: string, value: string, ttl: number = 120): Promise<void> {
    await this.client.eval("redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('DEL',KEYS[2]); return 1", 2, `${REDIS_OTP_PREFIX}${key}`, `${REDIS_OTP_PREFIX}${key}:attempts`, value, ttl);
  }

  async consumeOtp(key: string, candidate: string): Promise<boolean> {
    try {
      const result = await this.client.eval(`
        local expected=redis.call('GET',KEYS[1]);
        if not expected then return 0 end;
        local attempts=redis.call('INCR',KEYS[2]);
        if attempts==1 then redis.call('EXPIRE',KEYS[2],300) end;
        if attempts>5 then redis.call('DEL',KEYS[1]); return 0 end;
        if expected==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end;
        return 0`, 2, `${REDIS_OTP_PREFIX}${key}`, `${REDIS_OTP_PREFIX}${key}:attempts`, candidate);
      return result === 1;
    } catch { throw new ServiceUnavailableException('Authentication temporarily unavailable'); }
  }
  async getOtp(key: string): Promise<string | null> { return this.client.get(`${REDIS_OTP_PREFIX}${key}`); }
  async deleteOtp(key: string): Promise<void> { await this.client.del(`${REDIS_OTP_PREFIX}${key}`); }

  getClient(): Redis {
    return this.client;
  }

  getClientStatus(): string {
    return this.client.status;
  }
}
