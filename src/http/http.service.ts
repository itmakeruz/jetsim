import { Injectable, HttpException, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';

@Injectable()
export class HttpService {
  private params: any;
  private body: any;
  private method: string;
  private url = '';
  private headers: Record<string, string> = {};
  private timeout = 5000;
  private isLog = false;

  setParams(params: any): this {
    this.params = params;
    return this;
  }

  setBody(body: any): this {
    this.body = body;
    return this;
  }

  setMethod(method: string): this {
    this.method = method;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  setHeaders(headers: any): this {
    this.headers = headers;
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

  async send(): Promise<any> {
    try {
      const config: AxiosRequestConfig = {
        url: this.url,
        method: 'POST',
        data: this.params,
        timeout: this.timeout,
        headers: this.headers,
      };

      const res = await axios(config);
      console.log(res, 'responsman men');

      if (this.isLog) {
        Logger.log({
          url: this.url,
          request: this.params,
          response: res.data,
        });
      }

      return res.data;
    } catch (error: any) {
      console.log(error.response.data);

      throw new HttpException(error.response?.data || error.message, error.response?.status || 500);
    }
  }
}
