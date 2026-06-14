import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@CurrentUser('organizationId') orgId: string) {
    return this.branches.list(orgId);
  }

  @Roles(Role.ORG_ADMIN)
  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateBranchDto) {
    return this.branches.create(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branches.update(orgId, id, dto);
  }
}
