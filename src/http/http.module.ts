import { TBank } from './tbank.gateway';
import { Module } from '@nestjs/common';
import { JoyTel } from './joy-tel.gateway';
import { HttpService } from './http.service';
import { BillionConnectService } from './billion-connect.gateway';

@Module({
  controllers: [],
  providers: [HttpService, JoyTel, BillionConnectService, TBank],
  exports: [JoyTel, BillionConnectService, TBank, HttpService],
})
export class HttpModule {}
