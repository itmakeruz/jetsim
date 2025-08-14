import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { GatewayService } from './gateway.service';
import { Server, Socket } from 'socket.io';
import { JwtStrategy } from '@strategy';
import { IUser } from '@interfaces';

@WebSocketGateway()
export class GatewayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly jwtStrategy: JwtStrategy) {}
  @WebSocketServer() server: Server;

  handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = client.handshake.query?.token as string;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtStrategy.verify(token);
      console.log(payload);

      if (!payload?.id) {
        client.disconnect();
        return;
      }

      client.join(`user_${payload.id}`);
      console.log(`Client ${client.id} joined room user_${payload.id}`);
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: any) {
    console.log(client.id, 'disconnected');
  }

  @SubscribeMessage('action')
  async action(@ConnectedSocket() client: Socket) {}

  async sendOrderMessage(user_id: number, order_id: number) {
    this.server.to(`user_${user_id}`).emit('order', order_id);
  }
}
