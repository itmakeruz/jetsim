import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { GatewayGateway } from './gateway.gateway';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  constructor(private socket: GatewayGateway) {
    setTimeout(() => {
      this.sendMessage();
    }, 5000);
  }

  async sendMessage() {}

  async gateway(body: any) {
    console.log('request');
    return await new Promise((resolve, reject) => {
      this.socket.server.timeout(10000).emit(
        'request',
        {
          url: body.url,
          method: body.method,
          body: body.data,
        },
        (err, response) => {
          if (!err) return resolve(response);

          reject(err);
          console.log('response', err, JSON.stringify(response, null, 4));
        },
      );
    });
  }

  sendToMessage(id: string, event: string, data: any) {}
}
