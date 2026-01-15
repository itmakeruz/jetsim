import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetDashboardDto } from './dto';
import { Roles } from '@decorators';
import { UserRoles } from '@prisma/client';
import { AtGuard, RolesGuard } from '@guards';
import { ApiOperation } from '@nestjs/swagger';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ description: 'Get Dashboard statistics' })
  @Get()
  // @UseGuards(AtGuard, RolesGuard)
  // @Roles(UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.ACCOUNTANT)
  async get(@Query() query: GetDashboardDto) {
    return this.dashboardService.get(query);
  }
}
