import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { OutstandingService } from './outstanding.service';

@Controller('outstanding')
export class OutstandingController {
  constructor(private readonly outstanding: OutstandingService) {}

  @Get('customers')
  customers(@CurrentUser('organizationId') orgId: string) {
    return this.outstanding.customerOutstanding(orgId);
  }

  @Get('suppliers')
  suppliers(@CurrentUser('organizationId') orgId: string) {
    return this.outstanding.supplierOutstanding(orgId);
  }

  @Get('summary')
  summary(@CurrentUser('organizationId') orgId: string) {
    return this.outstanding.summary(orgId);
  }

  @Get('aging')
  aging(@CurrentUser('organizationId') orgId: string) {
    return this.outstanding.customerAging(orgId);
  }
}
