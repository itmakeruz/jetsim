import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { UpdateOrderDto, GetOrderDto, AddToBasket } from './dto';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { BillionConnectCallbackResponse, IRequest } from '@interfaces';
import { HeadersValidation, Roles } from '@decorators';
import { DeviceHeadersDto } from '@enums';
import { AuthGuard } from '@nestjs/passport';
import { AtGuard, RolesGuard } from '@guards';
import { UserRoles } from '@prisma/client';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: 'Get orders admin', description: 'Get orders admin' })
  @Get('admin')
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async findAll(@Query() query: GetOrderDto) {
    return this.orderService.findAll(query);
  }

  @ApiOperation({ summary: 'Get orders admin', description: 'Get orders admin' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('cart')
  async getBascet(@Req() request: IRequest, @HeadersValidation() headers: DeviceHeadersDto) {
    return this.orderService.getBasket(request?.user?.id, headers?.lang);
  }

  @ApiOperation({ summary: 'Get orders public', description: 'Get orders public' })
  @Get('static')
  @UseGuards(AuthGuard('jwt'))
  async findStaticOrders(
    @Query() query: GetOrderDto,
    @Req() request: IRequest,
    @HeadersValidation() headers: DeviceHeadersDto,
  ) {
    return this.orderService.staticOrders(query, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'Get orders public', description: 'Get orders public' })
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }

  @ApiOperation({ summary: 'create order', description: 'create order' })
  @ApiBearerAuth()
  @Post('esim')
  @UseGuards(AuthGuard('jwt'))
  async create(@Req() request: IRequest) {
    return this.orderService.create(request?.user?.id, 2100);
  }

  @ApiOperation({ summary: 'Add items to basket public', description: 'Add items to basket public' })
  @ApiBody({ type: [AddToBasket] })
  @Post('add-items')
  @UseGuards(AuthGuard('jwt'))
  async addItemsToBascet(
    @Body() data: AddToBasket[],
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.addItemsToBasket(data, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'Add tariff to basket public', description: 'Add tariff to basket public' })
  @Post('add-to-basket')
  @UseGuards(AuthGuard('jwt'))
  async addTobascet(
    @Body() data: AddToBasket,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.addToBasket(data, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'remove item from basket public', description: 'remove item from basket public' })
  @Post('remove-item-from-basket')
  @UseGuards(AuthGuard('jwt'))
  async removeFromBascet(
    @Body() data: AddToBasket,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.removeFromBasket(data, request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'decrease item from basket public', description: 'decrease item from basket public' })
  @Post('decrease-item-from-basket')
  @UseGuards(AuthGuard('jwt'))
  async decreaseQuantity(
    @Body() data: AddToBasket,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.decreaseQuantity(data, request?.user?.id, headers.lang);
  }

  // @ApiOperation({ summary: 'Get Usage', description: 'Get Usage' })
  // // @UseGuards(AuthGuard('jwt'))
  // @Post('get-usage/:id')
  // async getUsage(@Param() param: ParamId) {
  //   return this.orderService.getUsage(param.id);
  // }

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
