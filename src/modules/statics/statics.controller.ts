import { Controller } from '@nestjs/common';
import { StaticsService } from './statics.service';

@Controller('statics')
export class StaticsController {
  constructor(private readonly staticsService: StaticsService) {}
}
