import { Injectable } from '@nestjs/common';
import { CreatePaymentDto, GetTransactionDto, UpdatePaymentDto } from './dto';
import { PrismaService } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { paginate } from '@helpers';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
  ) {}
  async findAll(query: GetTransactionDto) {
    const transactions = await paginate('transaction', {
      page: query?.page,
      size: query?.size,
      // filter: query?.filters,
      // sort: query?.sort,
      select: {
        id: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        created_at: true,
      },
    });

    return {
      success: true,
      message: '',
      ...transactions,
      data: transactions.data,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} payment`;
  }

  create(data: CreatePaymentDto) {
    return 'This action adds a new payment';
  }

  async acceptTransactionStatus(data: any) {
    this.logger.log('TBANK WEBHOOK DATA: ', data);
    console.log(data);
    return {
      success: true,
      message: '',
      data: data,
    };
  }

  update(id: number, data: UpdatePaymentDto) {
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    return `This action removes a #${id} payment`;
  }
}
