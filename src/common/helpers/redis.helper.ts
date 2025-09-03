import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_OTP_PREFIX } from '@config';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000); // 50ms dan 2000ms gacha qayta urinish
      },
    });

    // Ulanish holatini kuzatish uchun event listener'lar
    this.client.on('connect', () => {
      console.log('Redis ulanishi muvaffaqiyatli!');
    });

    this.client.on('error', (err) => {
      console.error('Redis ulanish xatosi:', err.message);
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

  // Modul yopilganda ulanishni uzish
  async onModuleDestroy() {
    await this.client.quit();
    console.log('Redis ulanishi uzildi.');
  }

  // OTP saqlash funksiyasi (TTL bilan)
  async setOtp(key: string, value: string, ttl: number = 300): Promise<void> {
    // 300 soniya = 5 daqiqa
    await this.client.set(`${REDIS_OTP_PREFIX}${key}`, value, 'EX', ttl); // Prefix qo'shildi
  }

  // OTP o'qish funksiyasi
  async getOtp(key: string): Promise<string | null> {
    return await this.client.get(`${REDIS_OTP_PREFIX}${key}`);
  }

  // OTP o'chirish funksiyasi
  async deleteOtp(key: string): Promise<void> {
    await this.client.del(`${REDIS_OTP_PREFIX}${key}`);
  }

  // Redis holatini tekshirish uchun qo‘shimcha metod
  getClientStatus(): string {
    return this.client.status;
  }
}
