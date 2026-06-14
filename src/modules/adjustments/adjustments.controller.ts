import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto } from './dto/adjustment.dto';

@RequireFeature(PlatformFeature.ADJUSTMENTS)
@Controller('adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.adjustments.list(orgId, branchId, supplierId);
  }

  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAdjustmentDto) {
    return this.adjustments.create(user, dto);
  }
}
