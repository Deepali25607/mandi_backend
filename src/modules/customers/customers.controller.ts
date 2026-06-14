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
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  findAll(@CurrentUser('organizationId') orgId: string, @Query('search') search?: string) {
    return this.customers.findAll(orgId, search);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.customers.findOne(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT, Role.SALES_OPERATOR)
  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateCustomerDto) {
    return this.customers.create(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT, Role.SALES_OPERATOR)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.ACCOUNTANT)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.customers.remove(orgId, id);
  }
}
