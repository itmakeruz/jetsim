import { HttpService } from './http.service';
import {
  JOYTEL_URL,
  JOYTEL_APP_ID,
  JOYTEL_APP_SECRET,
  JOYTEL_CUSTOMER_CODE,
  JOYTEL_CUSTOMER_AUTH,
  JOY_TEL_ORDER_URL,
} from '@config';
import * as crypto from 'crypto';
import { JOYTEL_RESPONSE_ERRORS } from '@constants';
import { InternalServerErrorException } from '@nestjs/common';
import { JoyTelEsimOrderResponse } from '@interfaces';

export class JoyTel extends HttpService {
  private baseUrl = JOYTEL_URL;
  private appId = JOYTEL_APP_ID;
  private appSecret = JOYTEL_APP_SECRET;
  private orderUrl = JOY_TEL_ORDER_URL;
  private customerCode = JOYTEL_CUSTOMER_CODE;
  private customerAuth = JOYTEL_CUSTOMER_AUTH;

  constructor(private readonly httpService: HttpService) {
    super();
  }

  async checkBalance(coupon: any, transaction_id: string) {
    const url = `${this.baseUrl}/esim/usage/query`;
    const ciphertext: string = this.generateCiphertext(transaction_id);
    const headers = this.generateHeaders(transaction_id, ciphertext);
    const body = { coupon };

    return await this.setUrl(url).setHeaders(headers).setBody(body).send();
  }

  async submitEsimOrder(
    receiverName: string,
    phoneNumber: string,
    email: string,
    productCode: string,
    quantity: number,
    orderId: number,
  ) {
    // try {
    const url = this.orderUrl;
    const timestamp = Date.now();
    const orderTid = `${this.customerCode}-${orderId}-${timestamp}`;

    const plainStr =
      this.customerCode +
      this.customerAuth +
      '3' +
      orderTid +
      receiverName +
      phoneNumber +
      timestamp +
      productCode +
      quantity;

    const autoGraph = crypto.createHash('sha1').update(plainStr).digest('hex');

    const body = {
      customerCode: this.customerCode,
      orderTid: orderTid,
      receiveName: receiverName,
      phone: phoneNumber,
      email: email,
      autoGraph: autoGraph,
      type: 3,
      replyType: 1,
      timestamp: this.generateTimeStamp(),
      itemList: [
        {
          productCode: productCode,
          quantity: quantity,
        },
      ],
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await this.setUrl(url).setHeaders(headers).setBody(body).send();
    return response.data as JoyTelEsimOrderResponse;
    // } catch (error) {
    //   console.log(error);

    //   throw new InternalServerErrorException();
    // }
  }

  async checkStatus(orderTid: string) {
    const url = 'https://api.joytelshop.com/customerApi/customerOrder/query';
    const ciphertext: string = this.generateCiphertext(orderTid);
    const headers = this.generateHeaders(orderTid, ciphertext);
    const timestamp = this.generateTimeStamp();
    const plainStr = this.customerCode + this.customerAuth + '3' + orderTid + timestamp;

    const autoGraph = crypto.createHash('sha1').update(plainStr).digest('hex');

    const body = {
      customerCode: this.customerCode,
      timestamp: this.generateTimeStamp(),
      autoGraph: autoGraph,
      orderCode: orderTid,
    };

    const response = await this.setUrl(url).setHeaders(headers).setBody(body).send();
    return response.data as JoyTelEsimOrderResponse;
  }

  // HELPERS
  generateCiphertext(transaction_id: string): string {
    return crypto
      .createHash('md5')
      .update(this.appId + transaction_id + this.generateTimeStamp() + this.appSecret)
      .digest('hex');
  }

  generateAutoGraph(autoGraph: string) {
    return crypto.createHash('sha1').update(autoGraph).digest('hex');
  }

  generateHeaders(transaction_id: string, ciphertext: string) {
    return {
      'Content-Type': 'application/json',
      'AppId': this.appId,
      'TransId': transaction_id,
      'Timestamp': this.generateTimeStamp().toString(),
      'Ciphertext': ciphertext,
    };
  }

  generateTimeStamp() {
    return Date.now().toString();
  }

  async prepareRequest() {}
}
