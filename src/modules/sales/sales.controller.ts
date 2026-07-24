import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto } from './dto/sale.dto';

/**
 * The supplier rate (and its gross) is the agent's confidential margin —
 * strip it from every response unless the caller is the Org Admin.
 */
function hideSupplierRate<T extends { lines?: object[] }>(sale: T, role?: Role | string): T {
  if (role === Role.ORG_ADMIN) return sale;
  return {
    ...sale,
    lines: sale.lines?.map((l) => {
      const rest = { ...l } as Record<string, unknown>;
      delete rest.supplierRate;
      delete rest.supplierGrossAmount;
      return rest;
    }),
  };
}

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const sales = await this.sales.list(user.organizationId!, user.branchId!);
    return sales.map((s) => hideSupplierRate(s, user.role));
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return hideSupplierRate(await this.sales.findOneWithLock(user.organizationId!, id), user.role);
  }

  @Roles(Role.SALES_OPERATOR, Role.ACCOUNTANT)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return hideSupplierRate(await this.sales.create(user, dto), user.role);
  }

  @Roles(Role.SALES_OPERATOR, Role.ACCOUNTANT)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return hideSupplierRate(await this.sales.update(user, id, dto), user.role);
  }

  // Deleting a sale is restricted to the Org Admin.
  @Roles(Role.ORG_ADMIN)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.sales.remove(orgId, id);
  }
}
