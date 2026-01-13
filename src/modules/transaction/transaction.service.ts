import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { paginate } from '@helpers';
import { GetTransactionDto } from './dto';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetTransactionDto) {
    const where: any = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { status: { equals: search as any } },
        {
          user: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const { data, meta } = await paginate('transaction', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where,
      select: {
        id: true,
        amount: true, // BigInt keladi
        status: true,
        partner_transaction_id: true,
        order_id: true,
        user_id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone_number: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            created_at: true,
          },
        },
        created_at: true,
      },
    });

    const formattedData = data.map((item) => ({
      ...item,
      partner_transaction_id: Number(item?.partner_transaction_id),
      amount: Number(item?.amount) / 100,
    }));

    return {
      success: true,
      data: formattedData,
      meta,
    };
  }

  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        user: true,
        order: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Транзакция не найдена!');
    }

    return {
      success: true,
      data: {
        id: transaction?.id,
        amount: transaction?.amount,
        status: transaction?.status,
        partner_transaction_id: Number(transaction?.partner_transaction_id),
        order_id: transaction?.order_id,
        user_id: transaction?.user_id,
        created_at: transaction?.created_at,
      },
    };
  }
}
