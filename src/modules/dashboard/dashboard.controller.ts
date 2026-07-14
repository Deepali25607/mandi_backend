import { Controller, Get, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { PaymentMode } from '@/common/enums/domain.enum';
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

  /** Sales of one payment mode within a date range, for the split sales tiles. */
  @Get('sales-by-mode')
  salesByMode(
    @CurrentUser() user: AuthUser,
    @Query('mode') mode?: PaymentMode,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.salesByMode(user, mode ?? PaymentMode.CASH, from, to);
  }
}
