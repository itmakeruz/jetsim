// src/integrations/billion-connect.service.ts
import { GetUsageRequest } from '@interfaces';
import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
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

  constructor() {
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

  async getUsage(data: GetUsageRequest) {
    const payload = {
      tradeType: 'F046',
      tradeTime: this.formatDateTime(new Date()),
      tradeData: {
        orderId: data?.orderId,
        channelOrderId: data?.channelOrderId,
        iccid: data?.iccid,
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

  private formatDateTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
  }

  async isSuccess(data: any): Promise<boolean> {
    if (data?.tradeCode !== '1000') {
      return false;
    }
    return true;
  }
}
