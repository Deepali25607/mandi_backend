import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { ArrivalsService } from './arrivals.service';
import { CreateArrivalDto, UpdateArrivalDto } from './dto/arrival.dto';

@Controller('arrivals')
export class ArrivalsController {
  constructor(private readonly arrivals: ArrivalsService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.arrivals.list(orgId, branchId);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.arrivals.findOneWithLock(orgId, id);
  }

  @Roles(Role.PURCHASE_OPERATOR, Role.ACCOUNTANT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArrivalDto) {
    return this.arrivals.create(user, dto);
  }

  @Roles(Role.PURCHASE_OPERATOR, Role.ACCOUNTANT)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateArrivalDto,
  ) {
    return this.arrivals.update(user, id, dto);
  }
}
