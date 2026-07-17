import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { CashTransfersService } from './cash-transfers.service';
import { CreateCashTransferDto, UpdateCashTransferDto } from './dto/cash-transfer.dto';

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

  // Correcting or removing a recorded transfer rewrites the cash/bank books,
  // so only the org admin may do it.
  @Roles(Role.ORG_ADMIN)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCashTransferDto,
  ) {
    return this.transfers.update(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.transfers.remove(orgId, id);
  }
}
