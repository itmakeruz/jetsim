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
    return this.sendInit(payload);
  }

  async sendInit(payload: any) {
    console.log(payload);

    return this.http
      .setUrl(this.URL + '/v2/Init')
      .setMethod('POST')
      .setBody(payload)
      .setHeaders({ 'Content-Type': 'application/json' })
      .setTimeout(30)
      .setIsLog(true)
      .send();
  }

  //HELPERS
  private flatten(obj: any, prefix = '', result = {}) {
    for (const key in obj) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}${key}` : key;

      if (typeof value === 'object' && !Array.isArray(value)) {
        this.flatten(value, newKey, result);
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          this.flatten(item, `${newKey}${i}`, result);
        });
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  private generateToken(params: any, password: string): string {
    const flatObject = this.flatten(params);

    flatObject['Password'] = password;

    const sortedString = Object.keys(flatObject)
      .sort()
      .map((key) => flatObject[key])
      .join('');

    return crypto.createHash('sha256').update(sortedString).digest('hex');
  }

  private buildPayload(data: any) {
    const payload = {
      ...data,
      TerminalKey: this.TBANK_TERMINAL_ID,
    };

    payload.Token = this.generateToken(payload, this.PASSWORD);
    payload.NotificationURL = TBANK_WEBHOOK_URL;

    return payload;
  }
}
