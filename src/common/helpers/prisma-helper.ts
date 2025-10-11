import { type Prisma, type PrismaClient } from '@prisma/client';
import { HttpException } from '@nestjs/common';
import { Models } from '@enums';
import { FilterService } from '@helpers';
import { PrismaService } from 'src/modules/prisma/prisma.service';
export const prisma = new PrismaService();
type TFindMany<T extends Models> = Parameters<PrismaClient[T]['findMany']>[0];

export type PaginationResponse<T> = {
  data: T[];
  // totalPage: number;
  // currentPage: number;
  // hasNextPage: boolean;
  // hasPreviousPage: boolean;
  // totalItems: number;
  meta: {
    totalPage: number;
    totalSize: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    totalItems: number;
  };
};

type FindManyArgs<M extends Models> = Parameters<PrismaClient[M]['findMany']>[0];
type ClientType<T extends Models> = T & {
  findMany: (...args: TFindMany<T>[]) => Prisma.PrismaPromise<any>;
  count: (...args: any[]) => Prisma.PrismaPromise<any>;
};

export async function paginate<
  M extends Models,
  D = Prisma.PromiseReturnType<PrismaClient[M]['findMany']> extends Prisma.PrismaPromise<infer U>
    ? U
    : Prisma.PromiseReturnType<PrismaClient[M]['findFirstOrThrow']>,
>(
  model: M,
  options: {
    page?: number;
    size?: number;
    sort?: { column: string; value: Prisma.SortOrder };
    filter?: Array<{ column: string; operator: string; value: any }>;
  } & FindManyArgs<M>,
): Promise<PaginationResponse<D>> {
  let { page = 1, size = 20, filter, sort, select, ...otherOptions } = options;

  page = Number(page);
  size = Number(size);

  let { where, orderBy } = FilterService.applyFilters(filter, sort);

  if (page < 1 || size < 1) {
    throw new HttpException('Invalid page or limit', 403);
  }

  const client: ClientType<any> = prisma[model];

  const totalItems = await client.count({
    where: { ...where, ...options.where },
  });
  const totalPages = Math.ceil(totalItems / size);

  if (page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * size;

  const items = await client.findMany({
    skip: Math.abs(offset),
    take: size,
    orderBy,
    where: { ...where, ...options.where },
    select,
    ...otherOptions,
  });

  return {
    data: items,
    meta: {
      totalPage: totalPages,
      totalSize: size,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      totalItems,
    },
  };
}
