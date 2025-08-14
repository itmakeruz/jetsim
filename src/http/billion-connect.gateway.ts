import { HttpService } from './http.service';
import {
  BILLION_CONNECT_URL,
  BILLION_CONNECT_CHANNEL_ID,
  BILLION_CONNECT_SIGN_METHOD,
  BILLION_CONNECT_SECRET_KEY,
} from '@config';
import { InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

export class BillionConnect extends HttpService {
  private baseURL = BILLION_CONNECT_URL;
  private key = BILLION_CONNECT_SECRET_KEY;
  private channelId = BILLION_CONNECT_CHANNEL_ID;
  private signMethod = BILLION_CONNECT_SIGN_METHOD;

  constructor() {
    super();
  }

  async prepareRequest(data: any) {
    const headers = this.generateHeaders();
    headers['x-sign-value'] = this.generateSign(data);

    try {
      console.log(headers);
      const response = await this.setUrl(this.baseURL).setHeaders(headers).setBody(data).send();
      return response.data;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async checkSimcard(iccid: string) {
    const data = {
      tradeType: 'F010',
      tradeTime: this.generateDate(),
      tradeData: { iccid },
    };
    return data;
  }

  async orderSimcard(body: any) {
    const planId = body.plan_id;
    const data = {
      tradeType: 'F040',
      tradeTime: this.generateDate(),
      tradeData: {
        channelOrderId: planId,
        email: body.email,
        orderCreateTime: this.generateDate(),
        language: 2,
        subOrderList: [
          {
            channelSubOrderId: planId, //anigini so'rash kerak bo'ladi
            deviceSkuId: body.sku_id,
            planSkuCopies: body.day || 1,
            number: '1',
          },
        ],
      },
    };

    return this.prepareRequest(data);
  }

  async getInfoOrder(orderId: string) {
    const data = {
      tradeType: 'F011',
      tradeTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
      tradeData: { channelOrderId: orderId },
    };

    return data;
  }

  async allThing() {
    const data = {
      tradeType: 'F002',
      tradeTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
      tradeData: {
        salesMethod: '5',
        language: '2',
      },
    };
    return data;
  }

  //HELPERS

  generateDate() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  generateSign(data: any) {
    const sign = crypto
      .createHash('md5')
      .update(this.key + JSON.stringify(data))
      .digest('hex');

    return sign;
  }

  async generateHeaders() {
    return {
      'x-channel-id': this.channelId,
      'x-sign-method': this.signMethod,
    };
  }
}
