import { TBANK_PASSWORD, TBANK_TERMINAL_ID, TBANK_URL } from '@config';
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
  private generateToken(params: any, password: string): string {
    const data = {
      ...params,
      Password: password,
    };

    const sortedPaylaod = Object.keys(data)
      .sort()
      .map((key) => data[key])
      .join('');

    return crypto.createHash('sha256').update(sortedPaylaod).digest('hex');
  }

  private buildPayload(data: any) {
    const payload = {
      ...data,
      TerminalKey: this.TBANK_TERMINAL_ID,
    };

    payload.Token = this.generateToken(payload, this.PASSWORD);

    return payload;
  }
}
