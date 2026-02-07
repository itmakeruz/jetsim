import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { paginate, generateExcel } from '@helpers';
import { GetTransactionDto } from './dto';
import { dateConverter } from 'src/common/helpers/date-converter.helper';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhereFromQuery(query: GetTransactionDto): Prisma.TransactionWhereInput {
    const andConditions: Prisma.TransactionWhereInput[] = [];

    if (query.email?.trim()) {
      andConditions.push({
        user: { email: { contains: query.email.trim(), mode: 'insensitive' } },
      });
    }

    if (query.amount?.trim()) {
      andConditions.push({ amount: { contains: query.amount.trim() } });
    }

    if (query.status?.trim()) {
      andConditions.push({ status: query.status.trim() as any });
    }

    if (query.created_at?.trim()) {
      try {
        const dateStr = query.created_at.includes('_') ? query.created_at : `${query.created_at}_${query.created_at}`;
        const dateFilter = dateConverter(dateStr);
        if (dateFilter?.startDate && dateFilter?.endDate) {
          andConditions.push({
            created_at: {
              gte: dateFilter.startDate,
              lte: dateFilter.endDate,
            },
          });
        }
      } catch {
        // Invalid date format – ignore
      }
    }

    if (query.id != null && !isNaN(Number(query.id))) {
      andConditions.push({ id: Number(query.id) });
    }

    return andConditions.length > 0 ? { AND: andConditions } : {};
  }

  async findAll(query: GetTransactionDto) {
    const baseWhere = this.buildWhereFromQuery(query);

    const { data, meta } = await paginate('transaction', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
      where: baseWhere,
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

  async getTranscationsExcel(query: GetTransactionDto) {
    const { data } = await this.findAll({ ...query, size: 1000000, page: 1 });

    const excelData = data.map((item: any) => ({
      id: item.id,
      amount: item.amount,
      status: item.status,
      user_name: item.user?.name ?? '',
      user_email: item.user?.email ?? '',
      user_phone: item.user?.phone_number ?? '',
      order_id: item.order_id ?? '',
      partner_transaction_id: item.partner_transaction_id ?? '',
      created_at: item.created_at ? new Date(item.created_at).toISOString() : '',
    }));

    const columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Сумма', key: 'amount', width: 12 },
      { header: 'Статус', key: 'status', width: 20 },
      { header: 'Имя', key: 'user_name', width: 20 },
      { header: 'Email', key: 'user_email', width: 30 },
      { header: 'Телефон', key: 'user_phone', width: 18 },
      { header: 'Order ID', key: 'order_id', width: 10 },
      { header: 'Partner Transaction ID', key: 'partner_transaction_id', width: 22 },
      { header: 'Дата', key: 'created_at', width: 22 },
    ];

    return generateExcel(excelData, columns, 'Оч');
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
