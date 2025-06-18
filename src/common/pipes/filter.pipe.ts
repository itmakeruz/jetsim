import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseFiltersPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const filters: any[] = [];
    let existsFilter = false;
    if (value)
      Object.keys(value).forEach((key) => {
        let match = key.match(/^filters\[(\d+)]\.(\w+)$/);
        if (match) {
          existsFilter = true;
          const [_, index, field] = match;
          const idx = Number(index);
          filters[idx] = filters[idx] || {};
          filters[idx][field] = value[key];
          delete value[key];
        }
      });
    if (value?.sort && Object.keys(value).some((k) => k.startsWith('sort.'))) {
      let sort = {};

      Object.entries(value).forEach(([key, val]) => {
        const match = key.match(/^sort\.(.+)$/);
        if (match) {
          sort[match[1]] = val;
          delete value[key];
        }
      });

      value.sort = sort;
    }

    if (existsFilter) {
      value = {
        ...value,
        filters,
      };
    }

    return value;
  }
}
