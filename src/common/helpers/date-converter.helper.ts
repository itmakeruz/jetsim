import { BadRequestException } from '@nestjs/common';

export function dateConverter(date?: string) {
  if (!date) {
    return {
      startDate: undefined,
      endDate: undefined,
    };
  }

  const parts = date.split('_');

  if (!parts[0] || !parts[1]) {
    throw new BadRequestException('Неверный формат даты!');
  }

  const start = new Date(parts[0]);
  const end = new Date(parts[1]);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestException('Неверный тип даты!');
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start,
    endDate: end,
  };
}

export function dayAfterNConverter(date: Date, days: number): Date {
  let nextDate = new Date();
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}
