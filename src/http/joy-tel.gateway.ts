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
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { console } from 'inspector';

@Injectable()
export class JoyTel {
  private baseUrl = JOYTEL_URL;
  private appId = JOYTEL_APP_ID;
  private appSecret = JOYTEL_APP_SECRET;
  private orderUrl = JOY_TEL_ORDER_URL;
  private customerCode = JOYTEL_CUSTOMER_CODE;
  private customerAuth = JOYTEL_CUSTOMER_AUTH;

  constructor(private readonly httpService: HttpService) {
    console.log('JoyTel initialized with baseUrl:', JoyTel.name);
  }

  async checkBalance(coupon: any, transaction_id: string) {
    const url = `${this.baseUrl}/esim/usage/query`;
    const ciphertext: string = this.generateCiphertext(transaction_id);
    const headers = this.generateHeaders(transaction_id, ciphertext);
    const body = { coupon };
    console.log(url, ciphertext, headers, body);

    return await this.httpService.setUrl(url).setHeaders(headers).setBody(body).send();
  }
  async submitEsimOrder(
    orderId: number,
    receiverName: string,
    phoneNumber: string,
    email: string,
    productCode: string,
    quantity: number = 1,
  ) {
    console.log('keldim');

    const url = this.orderUrl;
    const timestamp = this.generateTimeStamp();
    const orderTid = `${this.customerCode}-${orderId}-${timestamp}`;

    const warehouse = '';
    const type = 3;

    const itemList = [
      {
        productCode,
        quantity,
      },
    ];
    console.log('keldim2');

    const plainStr =
      this.customerCode +
      this.customerAuth +
      warehouse +
      type +
      orderTid +
      receiverName +
      phoneNumber +
      timestamp +
      itemList.map((i) => i.productCode + i.quantity).join('');

    console.log('keldim3');
    const autoGraph = crypto.createHash('sha1').update(plainStr).digest('hex');
    console.log('keldim4');
    const body = {
      customerCode: this.customerCode,
      type,
      receiveName: receiverName,
      phone: phoneNumber,
      timestamp,
      orderTid,
      autoGraph,
      email,
      replyType: 1,
      warehouse,
      remark: '',
      itemList,
    };

    console.log('JoyTel ORDER URL >>>', url);
    console.log('plainStr >>>', plainStr);
    console.log('autoGraph >>>', autoGraph);
    console.log('body >>>', JSON.stringify(body));

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      console.log('salama');
      const response = await this.httpService.setUrl(url).setHeaders(headers).setBody(body).send();
      console.log('JoyTel RESPONSE >>>', response.data);
      return response.data;
    } catch (error) {
      console.error('JoyTel RAW ERROR >>>', error?.response?.data || error.message);
      throw new InternalServerErrorException('JoyTel order failed');
    }
  }

  async redeemCouponForQrCode(snPin: string): Promise<any> {
    const url = `https://esim.joytelecom.com/openapi/coupon/redeem`;
    const headers = this.generateRspHeaders();

    const payload = {
      coupon: snPin,
      qrcodeType: 1, // 0 - link to image, 1 - QR text
    };

    console.log('JoyTel Redeem URL >>>', url);
    console.log('Headers >>>', headers);
    console.log('Payload >>>', payload);

    return await this.httpService
      .setUrl(url)
      .setHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      })
      .setBody(payload)
      .send();
  }

  async getTransactionStatus() {}

  async orderQrCode(
    productCode: string,
    snCode: string,
    days: number = 1,
    orderTid: string = `${this.customerCode}-${Date.now()}`,
  ) {
    const url = 'https://api.joytelshop.com/joyRechargeApi/rechargeOrder';

    const timestamp = this.generateTimeStamp();

    const itemList = [
      {
        productCode, // recharge plan code
        snCode, // SIM / eSIM serial code
        days, // validity period
      },
    ];

    // Sign string (aniq tartibda!)
    const plainStr =
      this.customerCode +
      this.customerAuth +
      timestamp +
      itemList.map((i) => i.productCode + i.snCode + i.days).join('') +
      orderTid;

    const autoGraph = crypto.createHash('sha1').update(plainStr).digest('hex');

    const body = {
      customerCode: this.customerCode,
      orderTid,
      timestamp,
      autoGraph,
      itemList,
    };

    console.log('JoyTel Recharge URL >>>', url);
    console.log('plainStr >>>', plainStr);
    console.log('autoGraph >>>', autoGraph);
    console.log('body >>>', JSON.stringify(body));

    return await this.httpService
      .setUrl(url)
      .setHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      })
      .setBody(body)
      .send();
  }

  private generateRspHeaders() {
    const transId = '12332123131232';
    const timestamp = Date.now();
    const ciphertext = crypto
      .createHash('md5')
      .update(this.appId + transId + timestamp + this.appSecret)
      .digest('hex');

    return {
      'Content-Type': 'application/json',
      'AppId': this.appId,
      'TransId': transId,
      'Timestamp': timestamp.toString(),
      'Ciphertext': ciphertext,
    };
  }

  // HELPERS
  generateCiphertext(transaction_id: string): string {
    return crypto
      .createHash('md5')
      .update(this.appId + transaction_id + this.generateTimeStamp() + this.appSecret)
      .digest('hex');
  }

  // getError(): any {
  //   if (this.response?.error?.data) {
  //     return this.response?.error?.data || this?.errorUnknown;
  //   }
  //   return this.response?.error?.message || this?.errorUnknown;
  // }

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
    return Date.now();
  }

  async prepareRequest() {}
}
