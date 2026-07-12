import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto } from './dto/sale.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.sales.list(orgId, branchId);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.sales.findOneWithLock(orgId, id);
  }

  @Roles(Role.SALES_OPERATOR, Role.ACCOUNTANT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.sales.create(user, dto);
  }

  @Roles(Role.SALES_OPERATOR, Role.ACCOUNTANT)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.sales.update(user, id, dto);
  }
}
