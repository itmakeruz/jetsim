import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetDashboardDto } from './dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async get(@Query() query: GetDashboardDto) {
    return this.dashboardService.get(query);
  }
}
