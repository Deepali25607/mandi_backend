import { Controller, Get, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getOverview(user);
  }

  /** Itemised cash inflows/outflows behind the "Cash in Hand" tile (defaults to today). */
  @Get('cash-in-hand')
  cashInHand(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.dashboardService.cashInHand(user, date);
  }
}
