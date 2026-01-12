import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { GetTransactionDto } from './dto';
import { ParamId } from '@enums';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  findAll(@Query() query: GetTransactionDto) {
    return this.transactionService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() param: ParamId) {
    return this.transactionService.findOne(param.id);
  }
}
