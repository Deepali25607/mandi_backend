import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  findAll(@CurrentUser('organizationId') orgId: string, @Query('search') search?: string) {
    return this.suppliers.findAll(orgId, search);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.suppliers.findOne(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT, Role.PURCHASE_OPERATOR)
  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT, Role.PURCHASE_OPERATOR)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.suppliers.remove(orgId, id);
  }
}
