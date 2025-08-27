// src/integrations/billion-connect.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

interface SubOrderInput {
  channelSubOrderId: string; // Y
  deviceSkuId: string; // Y (ESIM product id)
  planSkuCopies: string; // Y (STRING bo'lsin, masalan "1")
  number: string; // Y (STRING: "1".."500")
  deviceSkuPrice?: string; // N
  discountAmount?: string; // N
  rechargeableESIM?: '0' | '1'; // N
}

interface CreateEsimOrderInput {
  channelOrderId: string; // Y (katalog bo'yicha unikal)
  email?: string; // N
  totalAmount?: string; // N
  discountAmount?: string; // N
  estimatedUseTime?: string; // N (YYYY-MM-DD)
  orderCreateTime?: string; // N (YYYY-MM-DD HH:mm:ss)
  comment?: string; // N
  invoiceType?: '0' | '1'; // N
  invoiceHead?: string; // N
  invoiceContent?: string; // N
  invoiceComment?: string; // N
  userId?: string; // N
  eid?: string; // N
  imei?: string; // N
  subOrderList: SubOrderInput[]; // Y
}

@Injectable()
export class BillionConnectService {
  private readonly baseURL = process.env.BILLION_CONNECT_URL as string;
  private readonly appKey = process.env.BILLION_CONNECT_APP_KEY as string; // x-channel-id GA KETADI
  private readonly appSecret = process.env.BILLION_CONNECT_APP_SECRET as string; // SIGN UCHUN
  private readonly signMethod = (process.env.BILLION_CONNECT_SIGN_METHOD || 'md5').toLowerCase();
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** F040: Create ESIM order */
  async createEsimOrder(input: CreateEsimOrderInput) {
    // Dokda ko‘rsatilgan formatlarga moslash
    const tradeTime = this.formatDateTime(new Date());
    const orderCreateTime = input.orderCreateTime || tradeTime;

    // STRING bo‘lishi shart bo‘lgan maydonlarni kafolatlaymiz
    const subOrderList = input.subOrderList.map((s) => ({
      channelSubOrderId: String(s.channelSubOrderId),
      deviceSkuId: String(s.deviceSkuId),
      planSkuCopies: String(s.planSkuCopies),
      number: String(s.number),
      ...(s.deviceSkuPrice ? { deviceSkuPrice: String(s.deviceSkuPrice) } : {}),
      ...(s.discountAmount ? { discountAmount: String(s.discountAmount) } : {}),
      ...(s.rechargeableESIM ? { rechargeableESIM: s.rechargeableESIM } : {}),
    }));

    // F040 body (dokdan ortiqcha field qo‘shmaslik ma’qul)
    const payload = {
      tradeType: 'F040',
      tradeTime,
      tradeData: {
        channelOrderId: String(input.channelOrderId),
        // ...(input.email ? { email: input.email } : {}),
        // ...(input.totalAmount ? { totalAmount: String(input.totalAmount) } : {}),
        // ...(input.discountAmount ? { discountAmount: String(input.discountAmount) } : {}),
        // ...(input.estimatedUseTime ? { estimatedUseTime: input.estimatedUseTime } : {}),
        orderCreateTime,
        // ...(input.comment ? { comment: input.comment } : {}),
        // ...(input.invoiceType ? { invoiceType: input.invoiceType } : {}),
        // ...(input.invoiceHead ? { invoiceHead: input.invoiceHead } : {}),
        // ...(input.invoiceContent ? { invoiceContent: input.invoiceContent } : {}),
        // ...(input.invoiceComment ? { invoiceComment: input.invoiceComment } : {}),
        // ...(input.userId ? { userId: input.userId } : {}),
        // ...(input.eid ? { eid: input.eid } : {}),
        // ...(input.imei ? { imei: input.imei } : {}),
        subOrderList,
        language: 2,
      },
    };

    // Imzo faqat BIR marta stringify qilingan JSON ustidan olinadi va xuddi shu JSON yuboriladi
    const payloadJson = JSON.stringify(payload);
    const sign = this.md5(this.appSecret + payloadJson);

    const headers = {
      'x-channel-id': this.appKey,
      'x-sign-method': this.signMethod, // 'md5'
      'x-sign-value': sign,
    };

    try {
      const response = await this.http.post('', payloadJson, { headers });
      // Kutilgan javob:
      // { tradeCode: "1000", tradeMsg: "...", tradeData: { orderId, channelOrderId, subOrderList: [...] } }
      if (!this.isSuccess(response.data)) {
        throw new InternalServerErrorException(response.data?.tradeMsg);
      }
      console.log(response, 'repsonse');
      console.log(response?.data, 'repsonse');

      return response.data;
    } catch (err: any) {
      // Tashxisga yordam berish uchun foydali ma’lumotlar
      const status = err?.response?.status;
      const resp = err?.response?.data;
      const msg = `BillionConnect F040 failed${status ? ` [${status}]` : ''}: ${JSON.stringify(resp || err.message)}`;
      throw new InternalServerErrorException(msg);
    }
  }

  // --- helperlar ---
  private md5(s: string) {
    return crypto.createHash('md5').update(s, 'utf8').digest('hex');
  }

  /** YYYY-MM-DD HH:mm:ss (local time) */
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
