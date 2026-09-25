import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRoles } from '@prisma/client';
import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { ReportsService } from './reports.service';
import { GetSalesReportDto } from './dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Отчёт по продажам eSIM: тариф, объём, покупатель, сумма, дата, статус' })
  @Get('sales')
  @ApiBearerAuth()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async getSales(@Query() query: GetSalesReportDto) {
    return this.reportsService.getSales(query);
  }

  @ApiOperation({ summary: 'Выгрузка отчёта по продажам в Excel (те же фильтры)' })
  @Get('sales/excel')
  @ApiBearerAuth()
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async getSalesExcel(@Query() query: GetSalesReportDto, @Res() res: Response) {
    const buffer = await this.reportsService.getSalesExcel(query);
    const filename = `otchot_po_prodazham_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
