import { Module } from '@nestjs/common';
import { HttpService } from './http.service';
import { JoyTel } from './joy-tel.gateway';
import { BillionConnect } from './billion-connect.gateway';

@Module({
  controllers: [],
  providers: [HttpService, JoyTel, BillionConnect],
  exports: [JoyTel, BillionConnect],
})
export class HttpModule {}
