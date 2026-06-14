import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { SettlementsService } from './settlements.service';
import { CreateBillDto, CreatePaymentDto, PreviewBillDto } from './dto/settlement.dto';

@RequireFeature(PlatformFeature.SETTLEMENTS)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  // ---- Supplier bills ----
  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post('bills/preview')
  preview(@CurrentUser('organizationId') orgId: string, @Body() dto: PreviewBillDto) {
    return this.settlements.previewBill(orgId, dto.supplierId, dto.fromDate, dto.toDate);
  }

  @Get('bills')
  listBills(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.settlements.listBills(orgId, branchId, supplierId);
  }

  @Get('bills/:id')
  findBill(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.settlements.findBill(orgId, id);
  }

  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post('bills')
  createBill(@CurrentUser() user: AuthUser, @Body() dto: CreateBillDto) {
    return this.settlements.createBill(user, dto);
  }

  // ---- Supplier payments ----
  @Get('payments')
  listPayments(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.settlements.listPayments(orgId, branchId, supplierId);
  }

  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post('payments')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.settlements.createPayment(user, dto);
  }
}
