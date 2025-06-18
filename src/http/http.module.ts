import { Module } from '@nestjs/common';
import { HttpService } from './http.service';

@Module({
  controllers: [],
  providers: [HttpService],
})
export class HttpModule {}
