import { Injectable } from '@nestjs/common';
import { CreateTariffDto, UpdateTariffDto } from './dto';

@Injectable()
export class TariffService {
  findAll() {
    return `This action returns all tariff`;
  }

  findOne(id: number) {
    return `This action returns a #${id} tariff`;
  }

  create(data: CreateTariffDto) {
    return 'This action adds a new tariff';
  }

  update(id: number, data: UpdateTariffDto) {
    return `This action updates a #${id} tariff`;
  }

  remove(id: number) {
    return `This action removes a #${id} tariff`;
  }
}
