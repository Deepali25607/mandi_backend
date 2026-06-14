import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('lots')
  lots(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('itemId') itemId?: string,
    @Query('available') available?: string,
  ) {
    return this.inventory.listLots(orgId, branchId, {
      itemId,
      availableOnly: available === 'true',
    });
  }

  @Get('summary')
  summary(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.inventory.summary(orgId, branchId);
  }
}
