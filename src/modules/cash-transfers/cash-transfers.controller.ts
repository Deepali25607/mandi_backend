import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { CashTransfersService } from './cash-transfers.service';
import { CreateCashTransferDto } from './dto/cash-transfer.dto';

@Controller('cash-transfers')
export class CashTransfersController {
  constructor(private readonly transfers: CashTransfersService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.transfers.list(orgId, branchId);
  }

  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCashTransferDto) {
    return this.transfers.create(user, dto);
  }
}
