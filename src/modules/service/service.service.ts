import { Injectable } from '@nestjs/common';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServiceService {
  findAll() {
    return `This action returns all service`;
  }

  findOne(id: number) {
    return `This action returns a #${id} service`;
  }
  create(data: CreateServiceDto) {
    return 'This action adds a new service';
  }

  update(id: number, data: UpdateServiceDto) {
    return `This action updates a #${id} service`;
  }

  remove(id: number) {
    return `This action removes a #${id} service`;
  }
}
