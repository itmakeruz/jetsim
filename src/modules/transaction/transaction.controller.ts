import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  @ApiOperation({ description: 'Get transactions history' })
  @Get()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  findAll(@Query() query: GetTransactionDto) {
    return this.transactionService.findAll(query);
  }

  @ApiOperation({ description: 'Get transaction details' })
  @Get(':id')
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  findOne(@Param() param: ParamId) {
    return this.transactionService.findOne(param.id);
  }
}
