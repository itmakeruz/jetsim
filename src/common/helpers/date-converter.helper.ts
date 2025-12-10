import { BadRequestException } from '@nestjs/common';

export function dateConverter(date: string) {
  const result = date?.split('_');
  const start = new Date(result[0]);
  const end = new Date(result[1]);

  // if (!(start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()))) {
  //   throw new Error();
  // }
  start?.setHours(0, 0, 0, 0);
  end?.setHours(23, 59, 59, 999);

  return {
    startDate: start ?? undefined,
    endDate: end ?? undefined,
  };
}
