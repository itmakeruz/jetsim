import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  GetOrderDto,
  AddToBasket,
  RemoveFromBasketDto,
  DecreaseQuantityDto,
} from './dto';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { IRequest, JoyTelCallbackResponse, NotifyResponseJoyTel } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto } from '@enums';
import { AuthGuard } from '@nestjs/passport';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Get orders admin', description: 'Get orders admin' })
  @Get('admin')
  async findAll(@Query() query: GetOrderDto) {
    return this.orderService.findAll(query);
  }

  @ApiOperation({ summary: 'Get orders public', description: 'Get orders public' })
  @Get('static')
  async findStaticOrders(
    @Query() query: GetOrderDto,
    @Req() request: IRequest,
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return this.orderService.staticOrders(query, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get orders public', description: 'Get orders public' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'create order', description: 'create order' })
  @Post('esim')
  async create(@Req() request: IRequest) {
    console.log(request?.user);
    return this.orderService.create(request?.user?.id);
  }

  @ApiOperation({ summary: 'Add tariff to basket public', description: 'Add tariff to basket public' })
  @ApiHeader({ name: 'x-session-id' })
  @UseGuards(AuthGuard('jwt'))
  @Post('add-to-basket')
  async addTobascet(
    @Body() data: AddToBasket,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    console.log(request?.user);

    return this.orderService.addToBascet(data, headers?.['x-session-id'], request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'remove item from basket public', description: 'remove item from basket public' })
  @ApiHeader({ name: 'x-session-id' })
  @UseGuards(AuthGuard('jwt'))
  @Post('remove-item-from-basket')
  async removeFromBascet(
    @Body() data: RemoveFromBasketDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.removeFromBasket(data.packeage_id, headers?.['x-session-id'], request?.user?.id);
  }

  @ApiOperation({ summary: 'decrease item from basket public', description: 'decrease item from basket public' })
  @ApiHeader({ name: 'x-session-id' })
  @UseGuards(AuthGuard('jwt'))
  @Post('decrease-item-from-basket')
  async decreaseQuantity(
    @Body() data: DecreaseQuantityDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.decreaseQuantity(data.packeage_id, headers?.['x-session-id'], request?.user?.id);
  }

  @Post('joytel/callback')
  async redeemCoupon(@Body() data: JoyTelCallbackResponse) {
    return this.orderService.redeemCoupon(data);
  }

  @Post('notify/coupon/redeem')
  async notifyCoupon(@Body() data: NotifyResponseJoyTel) {
    return this.orderService.notifyCoupon(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.remove(+id);
  }
}
