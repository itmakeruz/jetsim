import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';
import { CustomerGuard } from '../../common/guards/customer.guard';
import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { UpdatePaymentDto } from './dto';
import { DeviceHeadersDto, ParamId } from '@enums';
import { IRequest } from '@interfaces';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TBankWebHookResponse } from '@constants';
import { HeadersValidation } from '@decorators';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // @Get()
  // async findAll(@Query() query: GetTransactionDto) {
  //   return this.paymentService.findAll(query);
  // }

  // @Get(':id')
  // findOne(@Param() param: ParamId) {
  //   return this.paymentService.findOne(param.id);
  // }

  // @Post()
  // async create(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
  //   return this.paymentService.create(request?.user?.id, headers?.lang);
  // }

  @ApiOperation({ summary: 'Prepare payment request', description: 'Prepare payment request' })
  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Post('prepare-payment')
  async preparePayment(
    @Req() request: IRequest,
    @Body() data: { promo_code?: string },
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return this.paymentService.preparePayment(request?.user?.id, headers.lang, data?.promo_code);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerGuard)
  @Post('orders/:id/payment-link')
  resumePayment(
    @Req() request: IRequest,
    @Param('id', ParseIntPipe) id: number,
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return this.paymentService.resumePayment(request.user.id, id, headers.lang);
  }

  // @Post('accept-payment-test')
  // async acceptPaymentTest(@Req() request: IRequest, @Body() data: any) {
  //   return this.paymentService.acceptPaymentTest(request?.user?.id, data);
  // }

  @Post('accept-transaction-status')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain')
  acceptTransactionStatus(@Body() data: TBankWebHookResponse) {
    return this.paymentService.acceptTransactionStatus(data);
  }

  @Patch(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  update(@Param() param: ParamId, @Body() data: UpdatePaymentDto) {
    return this.paymentService.update(param.id, data);
  }

  @Delete(':id')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN)
  remove(@Param() param: ParamId) {
    return this.paymentService.remove(param.id);
  }
}
