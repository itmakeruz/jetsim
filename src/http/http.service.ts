import { Injectable, HttpException, Logger, HttpStatus } from '@nestjs/common';
import {
  JOYTEL_SECRET_ID,
  JOYTEL_SECRET_KEY,
  JOYTEL_URL,
  BILLION_CONNECT_SECRET_ID,
  BILLION_CONNECT_SECRET_KEY,
  BILLION_CONNECT_URL,
} from '@config';
import axios, { isAxiosError } from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class HttpService {
  private id: string;
  private params: any;
  private method: string;
  private timeout = 5000;
  private isLog = false;
  private url = '';

  setParams(params: any): this {
    this.params = params;
    return this;
  }

  setMethod(method: string): this {
    this.method = method;
    return this;
  }

  setId(id: string): this {
    this.id = id;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  setTimeout(seconds: number): this {
    this.timeout = seconds * 1000;
    return this;
  }

  setIsLog(isLog: boolean): this {
    this.isLog = isLog;
    return this;
  }

  // private generateToken(): string {
  //   const serviceId = QPS_SERVICE_ID;
  //   const serviceKey = QPS_SERVICE_KEY;

  //   if (!serviceId?.trim() || !serviceKey?.trim() || serviceKey.length < 32) {
  //     throw new HttpException('Секретный ключ неверен', 400);
  //   }

  //   const time = Math.floor(Date.now() / 1000);
  //   const hash = crypto
  //     .createHash('sha1')
  //     .update(serviceKey + time)
  //     .digest('hex');
  //   return `${serviceId}-${hash}-${time}`;
  // }

  // private generateId(): string {
  //   return Math.random().toString(36).substring(2, 15);
  // }

  // private getRequest(): PamRequest {
  //   return {
  //     jsonrpc: '2.0',
  //     id: this.id || this.generateId(),
  //     params: this.params,
  //     method: this.method,
  //   };
  // }

  // // !! Infinity Pay Api Request, only Post Method
  // async send(userId = 0, extraHeaders: any = {}): Promise<this> {
  //   const requestPayload = this.getRequest();

  //   if (!this.url) this.url = QPS_BASE_URL;

  //   const headers = {
  //     'Accept': 'application/json',
  //     'Content-Type': 'application/json; charset=utf-8',
  //     'Cash': 'have',
  //     'Auth': this.generateToken(),
  //     ...extraHeaders,
  //   };

  //   try {
  //     const res = await axios.post(this.url, requestPayload, {
  //       headers,
  //     });

  //     if (!res.data) {
  //       throw new HttpException('Response is empty', -2);
  //     }

  //     this.response = res.data;
  //   } catch (error) {
  //     throw new HttpException(error.message, error.status);
  //   } finally {
  //     if (this.isLog) {
  //       console.log('Request: ', this.getRequest());
  //       console.log('Response: ', this.getResponse());

  //       Logger.log({
  //         request: this.getRequest(),
  //         response: this.getResponse(),
  //         userId,
  //       });
  //     }
  //   }

  //   return this;
  // }

  // getResponse() {
  //   return this.response;
  // }

  // getResult() {
  //   return this.response?.result;
  // }

  // isOk(): boolean {
  //   return this.response && !this.response?.error?.code;
  // }

  // getErrorCode() {
  //   return this.response?.error.code ?? -1;
  // }

  // getMessage(): string {
  //   return this.response?.error?.message ?? 'Неизвестная ошибка';
  // }
}
