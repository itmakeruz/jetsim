import { Module } from '@nestjs/common';
import { HttpService } from './http.service';
import { JoyTel } from './joy-tel.gateway';
import { BillionConnectService } from './billion-connect.gateway';

@Module({
  controllers: [],
  providers: [HttpService, JoyTel, BillionConnectService],
  exports: [JoyTel, BillionConnectService],
})
export class HttpModule {}
