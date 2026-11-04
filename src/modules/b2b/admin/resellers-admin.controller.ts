import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ManagementKeyGuard } from '../guards/management-key.guard';
import {
  CancelOrderDto,
  CreateResellerDto,
  IssueKeyDto,
  MoneyOperationDto,
  PageQueryDto,
  RefundOrderDto,
  ResolveOrderDto,
  UpdateResellerDto,
  UpsertResellerTariffDto,
} from './dto/admin.dto';
import { OrdersAdminService } from './orders-admin.service';
import { ResellersAdminService } from './resellers-admin.service';

/** Управляющие методы: вызываются только нашим партнёрским backend по управляющему ключу. */
@ApiTags('b2b-admin')
@ApiHeader({ name: 'X-Management-Key', required: true })
@Controller('b2b-admin')
@UseGuards(ManagementKeyGuard)
export class ResellersAdminController {
  constructor(
    private readonly resellers: ResellersAdminService,
    private readonly orders: OrdersAdminService,
  ) {}

  @Post('resellers') create(@Body() dto: CreateResellerDto) { return this.resellers.createReseller(dto); }
  @Get('resellers') list() { return this.resellers.listResellers(); }
  @Get('resellers/:id') get(@Param('id', ParseIntPipe) id: number) { return this.resellers.getReseller(id); }
  @Patch('resellers/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResellerDto) { return this.resellers.updateReseller(id, dto); }

  @Post('resellers/:id/keys') issueKey(@Param('id', ParseIntPipe) id: number, @Body() dto: IssueKeyDto) { return this.resellers.issueKey(id, dto.name); }
  @Get('resellers/:id/keys') keys(@Param('id', ParseIntPipe) id: number) { return this.resellers.listKeys(id); }
  @Delete('resellers/:id/keys/:keyId') revoke(@Param('id', ParseIntPipe) id: number, @Param('keyId', ParseIntPipe) keyId: number) { return this.resellers.revokeKey(id, keyId); }

  @Get('tariffs') centralTariffs(@Query() q: PageQueryDto) { return this.resellers.listCentralTariffs(q); }
  @Get('resellers/:id/tariffs') resellerTariffs(@Param('id', ParseIntPipe) id: number) { return this.resellers.listResellerTariffs(id); }
  @Put('resellers/:id/tariffs/:tariffId')
  upsertTariff(@Param('id', ParseIntPipe) id: number, @Param('tariffId', ParseIntPipe) tariffId: number, @Body() dto: UpsertResellerTariffDto) {
    return this.resellers.upsertResellerTariff(id, tariffId, dto);
  }

  @Get('resellers/:id/balance') balance(@Param('id', ParseIntPipe) id: number) { return this.resellers.balance(id); }
  @Post('resellers/:id/topups') topUp(@Param('id', ParseIntPipe) id: number, @Body() dto: MoneyOperationDto, @Req() req: any) { return this.resellers.topUp(id, dto, req.actor); }
  @Post('resellers/:id/adjustments') adjust(@Param('id', ParseIntPipe) id: number, @Body() dto: MoneyOperationDto, @Req() req: any) { return this.resellers.adjust(id, dto, req.actor); }
  @Get('resellers/:id/ledger') ledger(@Param('id', ParseIntPipe) id: number, @Query() q: PageQueryDto) { return this.resellers.listLedger(id, q); }

  @Get('orders') orderList(@Query() q: PageQueryDto) { return this.orders.list(q); }
  @Get('orders/:id') order(@Param('id', ParseIntPipe) id: number) { return this.orders.get(id); }
  @Post('orders/:id/cancel') @HttpCode(200) cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelOrderDto, @Req() req: any) { return this.orders.cancel(id, dto, req.actor); }
  @Post('orders/:id/reconcile') @HttpCode(200) reconcile(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveOrderDto, @Req() req: any) { return this.orders.reconcile(id, dto, req.actor); }
  @Post('orders/:id/refund') @HttpCode(200) refund(@Param('id', ParseIntPipe) id: number, @Body() dto: RefundOrderDto, @Req() req: any) { return this.orders.refund(id, dto, req.actor); }
}
