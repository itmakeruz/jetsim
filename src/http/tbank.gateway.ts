import { TBANK_PASSWORD, TBANK_TERMINAL_ID, TBANK_URL, TBANK_WEBHOOK_URL } from '@config';
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { HttpService } from './http.service';
@Injectable()
export class TBank {
  private readonly URL = TBANK_URL;
  private readonly PASSWORD = TBANK_PASSWORD;
  private readonly TBANK_TERMINAL_ID = TBANK_TERMINAL_ID;
  constructor(private readonly http: HttpService) {}

  async initPayment(dto: any) {
    const payload = this.buildPayload(dto);
    return this.sendInit(payload, '/v2/Init');
  }

  async sendInit(payload: any, endpoint: string) {
    console.log(payload);

    return this.http
      .setUrl(this.URL + endpoint)
      .setMethod('POST')
      .setBody(payload)
      .setHeaders({ 'Content-Type': 'application/json' })
      .setTimeout(30)
      .setIsLog(true)
      .send();
  }

  async getPaymentStatus(paymentId: number) {
    const payload = {
      TerminalKey: TBANK_TERMINAL_ID,
      PaymentId: paymentId,
      Token: this.generateToken({ TerminalKey: TBANK_TERMINAL_ID, PaymentId: paymentId }, TBANK_PASSWORD),
    };

    return this.sendInit(payload, '/v2/GetState');
  }

  //HELPERS
  private generateToken(payload: any, password: string): string {
    const data: Record<string, any> = {};

    // Token faqat primitive root-level maydonlar bo‘yicha yaratiladi
    for (const key of Object.keys(payload)) {
      const val = payload[key];

      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        data[key] = val;
      }
    }

    data.Password = password;

    const sortedPayload = Object.keys(data)
      .sort()
      .map((key) => data[key])
      .join('');

    return crypto.createHash('sha256').update(sortedPayload).digest('hex');
  }

  private buildPayload(data: any) {
    const payload = {
      ...data,
      TerminalKey: this.TBANK_TERMINAL_ID,
      // NotificationURL: 'https://api.jetsim.ru/payment/accept-transaction-status',
      NotificationURL: TBANK_WEBHOOK_URL,
      // SuccessURL: 'https://jetsim.ru/inactive',
    };

    payload.Token = this.generateToken(payload, this.PASSWORD);

    return payload;
  }
}
