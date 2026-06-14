import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { ChallansService } from './challans.service';
import { CreateChallanDto, ReportChallanDto, SettleChallanDto } from './dto/challan.dto';

@RequireFeature(PlatformFeature.CHALLANS)
@Controller('challans')
export class ChallansController {
  constructor(private readonly challans: ChallansService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.challans.list(orgId, branchId);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.challans.findOne(orgId, id);
  }

  @Roles(Role.INVENTORY_MANAGER, Role.ACCOUNTANT, Role.SALES_OPERATOR)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChallanDto) {
    return this.challans.create(user, dto);
  }

  @Roles(Role.INVENTORY_MANAGER, Role.ACCOUNTANT)
  @Post(':id/report')
  report(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: ReportChallanDto) {
    return this.challans.report(orgId, id, dto);
  }

  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post(':id/settle')
  settle(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: SettleChallanDto) {
    return this.challans.settle(orgId, id, dto);
  }
}
