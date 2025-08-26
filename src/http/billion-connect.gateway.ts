import { HttpService } from './http.service';
import { BILLION_CONNECT_URL, BILLION_CONNECT_APP_KEY, BILLION_CONNECT_APP_SECRET } from '@config';
import { InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

export class BillionConnect extends HttpService {
  private baseURL = BILLION_CONNECT_URL;
  private appKey = BILLION_CONNECT_APP_KEY; // x-channel-id
  private appSecret = BILLION_CONNECT_APP_SECRET; // sign uchun ishlatiladi

  constructor() {
    super();
  }

  async prepareRequest(data: any) {
    const headers = await this.generateHeaders(data);

    try {
      const response = await this.setUrl(this.baseURL).setHeaders(headers).setBody(data).send();
      return response.data;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async orderSimcard(body: any) {
    const data = {
      tradeType: 'F040',
      tradeTime: this.generateDate(),
      tradeData: {
        channelOrderId: body.order_id, // sizning asosiy order id
        // email: body.email,
        orderCreateTime: this.generateDate(),
        subOrderList: [
          {
            channelSubOrderId: body.plan_id, // sizning sub-order id
            deviceSkuId: body.sku_id,
            planSkuCopies: String(body.day || 1),
            number: String(body.quantity || 1),
          },
        ],
      },
    };

    return await this.prepareRequest(data);
  }

  // HELPERS

  generateDate() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  generateSign(data: any) {
    const raw = this.appSecret + JSON.stringify(data);
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  async generateHeaders(data: any) {
    return {
      'Content-Type': 'application/json;charset=UTF-8',
      'x-channel-id': this.appKey,
      'x-sign-method': 'md5',
      'x-sign-value': this.generateSign(data),
    };
  }
}
