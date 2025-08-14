import { Global, Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { GatewayGateway } from './gateway.gateway';
import { JwtStrategy } from '@strategy';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [GatewayGateway, GatewayService, JwtStrategy],
  exports: [GatewayService, GatewayGateway],
})
export class GatewayModule {}
