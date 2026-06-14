import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expense.dto';

@RequireFeature(PlatformFeature.EXPENSES)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expenses.list(orgId, branchId, { from, to });
  }

  @Roles(Role.ACCOUNTANT, Role.ORG_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user, dto);
  }
}
