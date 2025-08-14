import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import { ParamId } from '@enums';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  findOne(@Param() param: ParamId) {
    return this.paymentService.findOne(param.id);
  }

  @Post()
  create(@Body() data: CreatePaymentDto) {
    return this.paymentService.create(data);
  }

  @Patch(':id')
  update(@Param() param: ParamId, @Body() data: UpdatePaymentDto) {
    return this.paymentService.update(param.id, data);
  }

  @Delete(':id')
  remove(@Param() param: ParamId) {
    return this.paymentService.remove(param.id);
  }
}
