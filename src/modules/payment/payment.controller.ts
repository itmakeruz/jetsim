import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, GetTransactionDto, UpdatePaymentDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  async findAll(@Query() query: GetTransactionDto) {
    return this.paymentService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() param: ParamId) {
    return this.paymentService.findOne(param.id);
  }

  @Post()
  async create(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.paymentService.create(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Prepare payment request', description: 'Prepare payment request' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('prepare-payment')
  async preparePayment(@Req() request: IRequest, @Body() data: any) {
    return this.paymentService.preparePayment(request?.user?.id, data);
  }

  @Post('accept-payment-test')
  async acceptPaymentTest(@Req() request: IRequest, @Body() data: any) {
    return this.paymentService.acceptPaymentTest(request?.user?.id, data);
  }

  // @Post('accept-transaction-status')
  // acceptTransactionStatus(@Body() data: any) {
  //   return this.paymentService.create(data);
  // }

  @Patch(':id')
  update(@Param() param: ParamId, @Body() data: UpdatePaymentDto) {
    return this.paymentService.update(param.id, data);
  }

  @Delete(':id')
  remove(@Param() param: ParamId) {
    return this.paymentService.remove(param.id);
  }
}
