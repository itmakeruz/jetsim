import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TransactionService } from './transaction.service';
import { GetTransactionDto } from './dto';
import { ParamId } from '@enums';
import { ApiOperation } from '@nestjs/swagger';
import { AtGuard, RolesGuard } from '@guards';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @ApiOperation({ description: 'Get transaction details' })
  @Get(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  findOne(@Param() param: ParamId) {
    return this.transactionService.findOne(param.id);
  }

  @ApiOperation({ description: 'Get transactions history' })
  @Get()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  findAll(@Query() query: GetTransactionDto) {
    return this.transactionService.findAll(query);
  }

  @ApiOperation({ description: 'Export transactions to Excel (same filters as GET /transaction)' })
  @Get('export/excel')
  async exportExcel(@Query() query: GetTransactionDto, @Res() res: Response) {
    const buffer = await this.transactionService.getTranscationsExcel(query);
    const filename = `otchot_po_transaction_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
