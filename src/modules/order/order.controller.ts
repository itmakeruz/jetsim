import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { ApiOperation } from '@nestjs/swagger';
import { IRequest } from '@interfaces';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async findAll() {
    return this.orderService.findAll();
  }

  @Get('static')
  async findStaticOrders(@Req() request: IRequest) {
    return this.orderService.staticOrders(request.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }

  @ApiOperation({ summary: 'create order', description: 'create order' })
  @Post('esim')
  async create(@Body() createOrderDto: CreateOrderDto) {
    let user_id = 1;
    return this.orderService.create(createOrderDto, user_id);
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
