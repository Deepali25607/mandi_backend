import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { AccountingService } from './accounting.service';

@RequireFeature(PlatformFeature.ACCOUNTING)
@Roles(Role.ACCOUNTANT, Role.ORG_ADMIN, Role.AUDITOR)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('customer-ledger/:customerId')
  customerLedger(@CurrentUser('organizationId') orgId: string, @Param('customerId') customerId: string) {
    return this.accounting.customerLedger(orgId, customerId);
  }

  @Get('supplier-ledger/:supplierId')
  supplierLedger(@CurrentUser('organizationId') orgId: string, @Param('supplierId') supplierId: string) {
    return this.accounting.supplierLedger(orgId, supplierId);
  }

  @Get('cash-book')
  cashBook(@CurrentUser('organizationId') orgId: string, @Query('kind') kind?: string) {
    return this.accounting.cashBook(orgId, kind === 'bank' ? 'bank' : 'cash');
  }

  @Get('trial-balance')
  trialBalance(@CurrentUser('organizationId') orgId: string) {
    return this.accounting.trialBalance(orgId);
  }
}
