import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  GetOrderDto,
  AddToBascet,
  RemoveFromBascetDto,
  DecreaseQuantityDto,
} from './dto';
import { ApiOperation } from '@nestjs/swagger';
import { IRequest } from '@interfaces';
import { HeadersValidation } from '@decorators';
import { DeviceHeadersDto } from '@enums';

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

  @ApiOperation({ summary: 'create order', description: 'create order' })
  @Post('esim')
  async create(@Body() createOrderDto: CreateOrderDto) {
    let user_id = 1;
    return this.orderService.create(user_id);
  }

  @ApiOperation({ summary: 'Add tariff to bascet public', description: 'Add tariff to bascet public' })
  @Post('add-to-bascet')
  async addTobascet(
    @Body() data: AddToBascet,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.addToBascet(data, headers?.['x-session-id'], request?.user?.id, headers.lang);
  }

  @ApiOperation({ summary: 'remove item from bascet public', description: 'remove item from bascet public' })
  @Post('remove-item-from-bascet')
  async removeFromBascet(
    @Body() data: RemoveFromBascetDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.removeFromBasket(data.packeage_id, headers?.['x-session-id'], request?.user?.id);
  }

  @ApiOperation({ summary: 'decrease item from bascet public', description: 'decrease item from bascet public' })
  @Post('decrease-item-from-bascet')
  async decreaseQuantity(
    @Body() data: DecreaseQuantityDto,
    @HeadersValidation() headers: DeviceHeadersDto,
    @Req() request: IRequest,
  ) {
    return this.orderService.decreaseQuantity(data.packeage_id, headers?.['x-session-id'], request?.user?.id);
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
