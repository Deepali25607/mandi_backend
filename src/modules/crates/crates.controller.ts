import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { CratesService } from './crates.service';
import { CreateCrateDto } from './dto/crate.dto';

@RequireFeature(PlatformFeature.CRATES)
@Controller('crates')
export class CratesController {
  constructor(private readonly crates: CratesService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.crates.list(orgId, branchId);
  }

  @Get('balances')
  balances(@CurrentUser('organizationId') orgId: string) {
    return this.crates.balances(orgId);
  }

  @Roles(Role.INVENTORY_MANAGER, Role.ACCOUNTANT, Role.SALES_OPERATOR)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrateDto) {
    return this.crates.create(user, dto);
  }
}
