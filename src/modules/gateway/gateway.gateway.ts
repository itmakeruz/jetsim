import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtStrategy } from '@strategy';
@WebSocketGateway()
export class GatewayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly jwtStrategy: JwtStrategy) {}
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket, ..._: any[]) {
    try {
      const token = client?.handshake.auth?.token as string;

      if (!token) {
        client.disconnect();
        return;
      }

      const raw = this.jwtStrategy.verify(token);
      const payload = await this.jwtStrategy.validate(raw);
      if (payload.type !== 'user') { client.disconnect(); return; }
      if (!payload?.id) {
        client.disconnect();
        return;
      }

      client.data.authPayload = raw;
      const expiryTimer = setTimeout(() => client.disconnect(), Math.max(0, ((raw as any).exp * 1000) - Date.now()));
      expiryTimer.unref();
      client.once('disconnect', () => clearTimeout(expiryTimer));
      client.join(`user_${payload.id}`);
      console.log(`Client ${client.id} joined room user_${payload.id}`);
    } catch (e) {
      console.log(e?.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: any) {
    console.log(client.id, 'disconnected');
  }

  @SubscribeMessage('action')
  async action(@ConnectedSocket() client: Socket) {}

  private async emitToOwner(userId: number, event: string, body: any) {
    for (const socket of await this.server.in(`user_${userId}`).fetchSockets()) {
      try {
        const raw = socket.data.authPayload;
        if (!raw || raw.exp * 1000 <= Date.now()) throw new Error('Expired session');
        const principal = await this.jwtStrategy.validate(raw);
        if (principal.type !== 'user' || principal.id !== userId) throw new Error('Wrong owner');
        socket.emit(event, body);
      } catch { socket.disconnect(); }
    }
  }
  async sendPaymentStatus(user_id: number, status: { status: string }) {
    await this.emitToOwner(user_id, 'payment_status', status);
  }
  async sendOrderMessage(user_id: number, order_id: number, qrcode: string) {
    await this.emitToOwner(user_id, 'order', { order_id, qrcode });
  }
  async sendErrorOrderMessage(user_id: number, order_id: number) {
    await this.emitToOwner(user_id, 'error_order', { order_id });
  }
}
