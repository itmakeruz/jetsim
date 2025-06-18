import { PrismaClient } from '@prisma/client';
import { Models } from '@enums';

export class FilterService {
  static applyFilters(
    filters?: Array<{ column: any; operator: string; value: any }>,
    sort?: { column: string; value: 'asc' | 'desc' },
  ) {
    const query: any = {
      where: {},
      orderBy: {},
    };

    const fieldMapping: Record<string, string> = {
      code: 'user.code',
    };

    const getNestedObject = (parts: string[], value: any) => {
      return parts.reduceRight((acc, part) => ({ [part]: acc }), value);
    };

    filters?.forEach((filter) => {
      const mappedColumn = fieldMapping[filter.column] || filter.column;

      const columnParts = mappedColumn.split('.');
      const isNested = columnParts.length > 1;

      let valueCondition: any = {};
      if (mappedColumn == 'id') {
        filter.value = Number(filter.value);
      }

      switch (filter.operator) {
        case 'equals':
        case 'equal':
          valueCondition = { equals: filter.value };
          break;
        case 'contains':
          valueCondition = { contains: filter.value, mode: 'insensitive' };
          break;
        case 'between':
          if (typeof filter.value === 'string' && filter.value.includes('_')) {
            const [start, end] = filter.value.split('_');
            valueCondition = { gte: new Date(start), lte: new Date(end) };
          }
          break;
        case 'gte':
          valueCondition = { gte: filter.value };
          break;
        case 'lte':
          valueCondition = { lte: filter.value };
          break;
        default:
          valueCondition = { equals: filter.value };
      }

      if (isNested) {
        Object.assign(query.where, getNestedObject(columnParts, valueCondition));
      } else {
        query.where[mappedColumn] = valueCondition;
      }
    });

    if (sort && sort.column) {
      query.orderBy = { [sort.column]: sort.value };
    }

    query.orderBy = sort && sort.column ? { [sort.column]: sort.value } : { id: 'desc' };

    return { where: query.where, orderBy: query.orderBy };
  }
}
