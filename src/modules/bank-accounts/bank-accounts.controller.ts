import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/bank-account.dto';

@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly accounts: BankAccountsService) {}

  // Reads are open to any authenticated tenant user (needed for the receipt form).
  @Get()
  list(@CurrentUser('organizationId') orgId: string) {
    return this.accounts.list(orgId);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT)
  @Post()
  create(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string | null,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.accounts.create(orgId, branchId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.accounts.update(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.accounts.remove(orgId, id);
  }
}
