import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ResellerKeyGuard, ResellerPrincipal } from '../guards/reseller-key.guard';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { presentBalance, presentPartnerOrder } from '../presenters';
import { B2bCatalogService } from './b2b-catalog.service';
import { B2bEsimService } from './b2b-esim.service';
import { B2bOrdersService } from './b2b-orders.service';
import { CurrentReseller } from './current-reseller.decorator';
import { CreateB2bOrderDto, ListB2bOrdersQueryDto } from './dto/purchase.dto';

/** Закупочные методы компании. Ключ = компания; чужие данные недоступны. */
@ApiTags('b2b')
@ApiHeader({ name: 'X-Reseller-Key', required: true })
@Controller('b2b')
@UseGuards(ResellerKeyGuard)
export class B2bPurchaseController {
  constructor(
    private readonly catalog: B2bCatalogService,
    private readonly orders: B2bOrdersService,
    private readonly esim: B2bEsimService,
    private readonly ledger: ResellerLedgerService,
  ) {}

  @Get('tariffs')
  tariffs(@CurrentReseller() r: ResellerPrincipal) {
    return this.catalog.list(r.id);
  }

  @Get('balance')
  async balance(@CurrentReseller() r: ResellerPrincipal) {
    return presentBalance(await this.ledger.getBalance(r.id), r.currency);
  }

  @Post('orders')
  @HttpCode(202)
  async create(
    @CurrentReseller() r: ResellerPrincipal,
    @Body() dto: CreateB2bOrderDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { order, created } = await this.orders.create(r.id, dto);
    if (!created) res.setHeader('Idempotent-Replayed', 'true');
    return presentPartnerOrder(order);
  }

  @Get('orders')
  async list(@CurrentReseller() r: ResellerPrincipal, @Query() q: ListB2bOrdersQueryDto) {
    return (await this.orders.listForReseller(r.id, q)).map(presentPartnerOrder);
  }

  @Get('orders/:clientOrderId')
  async get(@CurrentReseller() r: ResellerPrincipal, @Param('clientOrderId') id: string) {
    return presentPartnerOrder(await this.orders.getForReseller(r.id, id));
  }

  @Get('orders/:clientOrderId/esim')
  getEsim(@CurrentReseller() r: ResellerPrincipal, @Param('clientOrderId') id: string) {
    return this.esim.getEsim(r.id, id);
  }

  @Get('orders/:clientOrderId/qr')
  async qr(@CurrentReseller() r: ResellerPrincipal, @Param('clientOrderId') id: string, @Res() res: Response) {
    // Заголовки ставим только после успешного получения PNG: иначе ответ-ошибка (JSON) ушёл бы с типом image/png
    const png = await this.esim.getQrPng(r.id, id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(png);
  }

  @Get('orders/:clientOrderId/usage')
  usage(@CurrentReseller() r: ResellerPrincipal, @Param('clientOrderId') id: string) {
    return this.esim.getUsage(r.id, id);
  }
}
