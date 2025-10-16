import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { UpdateOrderDto, GetOrderDto, AddToBasket, RemoveFromBasketDto, DecreaseQuantityDto } from './dto';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { BillionConnectCallbackResponse, IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto } from '@enums';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from '@guards';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Get orders admin', description: 'Get orders admin' })
  @Get('admin')
  async findAll(@Query() query: GetOrderDto) {
    return this.orderService.findAll(query);
  }

  @ApiOperation({ summary: 'Get orders admin', description: 'Get orders admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('cart')
  async getBascet(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.orderService.getBascet(request?.user?.id, headers?.lang);
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
    return this.orderService.create(request?.user?.id);
  }

  @ApiOperation({ summary: 'Add items to basket public', description: 'Add items to basket public' })
  @UseGuards(AuthGuard('jwt'))
  @Post('add-items')
  async addItemsToBascet(
    @Body() data: AddToBasket[],
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.addItemsToBascet(data, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'Add tariff to basket public', description: 'Add tariff to basket public' })
  @UseGuards(AuthGuard('jwt'))
  @Post('add-to-basket')
  async addTobascet(
    @Body() data: AddToBasket,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.addToBasket(data, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'remove item from basket public', description: 'remove item from basket public' })
  @UseGuards(AuthGuard('jwt'))
  @Post('remove-item-from-basket')
  async removeFromBascet(
    @Body() data: RemoveFromBasketDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.removeFromBasket(data.item_id, request?.user?.id);
  }

  @ApiOperation({ summary: 'decrease item from basket public', description: 'decrease item from basket public' })
  @UseGuards(AuthGuard('jwt'))
  @Post('decrease-item-from-basket')
  async decreaseQuantity(
    @Body() data: DecreaseQuantityDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.decreaseQuantity(data.item_id, request?.user?.id);
  }

  /**
   * Joytel callback endpoint
   */
  @Post('joytel/callback')
  async redeemCoupon(@Body() data: any) {
    return this.orderService.redeemCoupon(data);
  }

  /**
   * Joytel Notify callback endpoint
   */
  @Post('notify/coupon/redeem')
  async notifyCoupon(@Body() data: any) {
    return this.orderService.notifyCoupon(data);
  }

  @Post('bc/callback')
  async bcCallback(@Body() data: BillionConnectCallbackResponse) {
    return this.orderService.bcCallback(data);
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
