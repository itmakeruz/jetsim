// src/integrations/billion-connect.service.ts
import { GetUsageRequest, GetStatusRequest } from '@interfaces';
import { WinstonLoggerService } from '@logger';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

interface SubOrderInput {
  channelSubOrderId: string;
  deviceSkuId: string;
  planSkuCopies: string;
  number: string;
  deviceSkuPrice?: string;
  discountAmount?: string;
  rechargeableESIM?: '0' | '1';
}

interface CreateEsimOrderInput {
  channelOrderId: string;
  email?: string;
  totalAmount?: string;
  discountAmount?: string;
  estimatedUseTime?: string;
  orderCreateTime?: string;
  comment?: string;
  invoiceType?: '0' | '1';
  invoiceHead?: string;
  invoiceContent?: string;
  invoiceComment?: string;
  userId?: string;
  eid?: string;
  imei?: string;
  subOrderList: SubOrderInput[];
}

@Injectable()
export class BillionConnectService {
  private readonly baseURL = process.env.BILLION_CONNECT_URL as string;
  private readonly appKey = process.env.BILLION_CONNECT_APP_KEY as string;
  private readonly appSecret = process.env.BILLION_CONNECT_APP_SECRET as string;
  private readonly signMethod = (process.env.BILLION_CONNECT_SIGN_METHOD || 'md5').toLowerCase();
  private readonly http: AxiosInstance;

  constructor(private readonly logger: WinstonLoggerService) {
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async createEsimOrder(input: CreateEsimOrderInput) {
    const tradeTime = this.formatDateTime(new Date());
    const orderCreateTime = input.orderCreateTime || tradeTime;

    const subOrderList = input.subOrderList.map((s) => ({
      channelSubOrderId: String(s.channelSubOrderId),
      deviceSkuId: String(s.deviceSkuId),
      planSkuCopies: String(s.planSkuCopies),
      number: String(s.number),
      ...(s.deviceSkuPrice ? { deviceSkuPrice: String(s.deviceSkuPrice) } : {}),
      ...(s.discountAmount ? { discountAmount: String(s.discountAmount) } : {}),
      ...(s.rechargeableESIM ? { rechargeableESIM: s.rechargeableESIM } : {}),
    }));

    const payload = {
      tradeType: 'F040',
      tradeTime,
      tradeData: {
        channelOrderId: String(input.channelOrderId),
        orderCreateTime,
        subOrderList,
        language: 2,
      },
    };
    this.logger.log('BC INIT ORDER REQUEST: ', payload);

    const payloadJson = JSON.stringify(payload);
    const sign = this.md5(this.appSecret + payloadJson);

    const headers = {
      'x-channel-id': this.appKey,
      'x-sign-method': this.signMethod, // 'md5'
      'x-sign-value': sign,
    };

    try {
      const response = await this.http.post('', payloadJson, { headers });
      console.log(response);

      // if (!this.isSuccess(response.data)) {
      //   throw new InternalServerErrorException(response.data?.tradeMsg);
      // }

      return response.data;
    } catch (err: any) {
      console.log(err);

      const status = err?.response?.status;
      const resp = err?.response?.data;
      const msg = `BillionConnect F040 failed${status ? ` [${status}]` : ''}: ${JSON.stringify(resp || err.message)}`;
      throw new InternalServerErrorException(msg);
    }
  }

  async getPlans(iccid: string) {
    const payloadJson = JSON.stringify({
      tradeType: 'F012',
      tradeTime: this.formatDateTime(new Date()),
      tradeData: { iccid },
    });
    const response = await this.http.post('', payloadJson, {
      timeout: 12000,
      headers: {
        'x-channel-id': this.appKey,
        'x-sign-method': this.signMethod,
        'x-sign-value': this.md5(this.appSecret + payloadJson),
      },
    });
    return response.data;
  }

  async getUsage(data: GetUsageRequest) {
    const payload = {
      tradeType: 'F046',
      tradeTime: this.formatDateTime(new Date()),
      tradeData: {
        iccid: data?.iccid,
        orderId: data?.orderId,
        language: 2, //english,
      },
    };

    const payloadJson = JSON.stringify(payload);
    const sign = this.md5(this.appSecret + payloadJson);

    const headers = {
      'x-channel-id': this.appKey,
      'x-sign-method': this.signMethod, // 'md5'
      'x-sign-value': sign,
    };
    try {
      const response = await this.http.post('', payloadJson, { headers });
      // if (!this.isSuccess(response.data)) {
      //   throw new InternalServerErrorException(response.data?.tradeMsg);
      // }
      return response.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const resp = err?.response?.data;
      const msg = `BillionConnect F040 failed${status ? ` [${status}]` : ''}: ${JSON.stringify(resp || err.message)}`;
      throw new InternalServerErrorException(msg);
    }
  }

  async getStatus(data: GetStatusRequest) {
    const payload = {
      tradeType: 'F042',
      tradeTime: this.formatDateTime(new Date()),
      tradeData: {
        iccid: data?.iccid,
      },
    };

    const payloadJson = JSON.stringify(payload);
    const sign = this.md5(this.appSecret + payloadJson);

    const headers = {
      'x-channel-id': this.appKey,
      'x-sign-method': this.signMethod, // 'md5'
      'x-sign-value': sign,
    };

    try {
      const response = await this.http.post('', payloadJson, { headers });
      // if (!this.isSuccess(response.data)) {
      //   throw new InternalServerErrorException(response.data?.tradeMsg);
      // }
      return response.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const resp = err?.response?.data;
      const msg = `BillionConnect F040 failed${status ? ` [${status}]` : ''}: ${JSON.stringify(resp || err.message)}`;
      throw new InternalServerErrorException(msg);
    }
  }

  // async getQRCode(eid: string, orderId: string) {
  //   const tradeTime = this.formatDateTime(new Date());
  //   const orderCreateTime = tradeTime;

  //   const subOrderList = {};
  //   const payload = {
  //     tradeType: 'N009',
  //     tradeTime,
  //     tradeData: {
  //       orderId: 1,
  //       channelOrderId: eid,
  //     },
  //   };

  //   const payloadJson = JSON.stringify(payload);
  //   const sign = this.md5(this.appSecret + payloadJson);

  //   const headers = {
  //     'x-channel-id': this.appKey,
  //     'x-sign-method': this.signMethod, // 'md5'
  //     'x-sign-value': sign,
  //   };

  //   try {
  //     const response = await this.http.post('', payloadJson, { headers });
  //     if (!this.isSuccess(response.data)) {
  //       throw new InternalServerErrorException(response.data?.tradeMsg);
  //     }
  //     console.log(response, 'repsonse');
  //     console.log(response?.data, 'repsonse');

  //     return response.data;
  //   } catch (err: any) {
  //     const status = err?.response?.status;
  //     const resp = err?.response?.data;
  //     const msg = `BillionConnect F040 failed${status ? ` [${status}]` : ''}: ${JSON.stringify(resp || err.message)}`;
  //     throw new InternalServerErrorException(msg);
  //   }
  // }

  private md5(s: string) {
    return crypto.createHash('md5').update(s, 'utf8').digest('hex');
  }

  /**
   * BillionConnect — китайская площадка, их API ожидает время в Asia/Shanghai
   * (UTC+8, без перехода на летнее). Раньше здесь были d.getHours() и
   * прочие "локальные" геттеры Date — они берут часовой пояс процесса Node,
   * какой бы он ни был на сервере, и никак не приводят его к Шанхаю. Из-за
   * этого orderCreateTime/tradeTime уезжали на несколько часов от реального
   * времени запроса — BillionConnect поймал это на заказе #4580 (прислали
   * 13 окт 21:33 вместо фактических 14 окт 03:44). Теперь время считается
   * явно в их таймзоне, независимо от того, в каком поясе крутится сервер.
   */
  private formatDateTime(d: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    // Защита от известной особенности ICU: hour12:false иногда отдаёт "24"
    // вместо "00" для полуночи на некоторых версиях Node/ICU.
    const hour = get('hour') === '24' ? '00' : get('hour');

    return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
  }

  async isSuccess(data: any): Promise<boolean> {
    if (data?.tradeCode !== '1000') {
      return false;
    }
    return true;
  }
}
