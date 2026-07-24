import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
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

  // Daily rate updates: admin, stock keeper and the sales counter.
  @Roles(Role.ORG_ADMIN, Role.INVENTORY_MANAGER, Role.SALES_OPERATOR)
  @Post()
  set(@CurrentUser() user: AuthUser, @Body() dto: SetItemPriceDto) {
    return this.prices.set(user, dto);
  }
}
