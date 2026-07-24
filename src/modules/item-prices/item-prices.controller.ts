import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { ItemPricesService } from './item-prices.service';
import { SetItemPriceDto } from './dto/item-price.dto';

@Controller('item-prices')
export class ItemPricesController {
  constructor(private readonly prices: ItemPricesService) {}

  // Reads are open to any authenticated tenant user — the latest price is
  // reflected everywhere (sale entry, item master, …).
  @Get('latest')
  latest(@CurrentUser('organizationId') orgId: string) {
    return this.prices.latest(orgId);
  }

  @Get('history/:itemId')
  history(@CurrentUser('organizationId') orgId: string, @Param('itemId') itemId: string) {
    return this.prices.history(orgId, itemId);
  }

  /** Org-wide change log across all items (Reports → Price History). */
  @Get('log')
  log(@CurrentUser('organizationId') orgId: string) {
    return this.prices.log(orgId);
  }

  // Daily rate updates are open to every org user — each change is logged
  // with who made it, so the audit trail (not a role gate) is the control.
  @Post()
  set(@CurrentUser() user: AuthUser, @Body() dto: SetItemPriceDto) {
    return this.prices.set(user, dto);
  }
}
