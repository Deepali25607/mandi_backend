import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { ASSIGNABLE_SCREENS } from '@/common/config/screens';
import { CustomRolesService } from './custom-roles.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto } from './dto/custom-role.dto';

/** Org-Admin management of organization-defined (custom) roles. */
@Roles(Role.ORG_ADMIN)
@Controller('custom-roles')
export class CustomRolesController {
  constructor(private readonly roles: CustomRolesService) {}

  /** Catalogue of screens an admin can grant (for the role editor UI). */
  @Get('screens')
  screens() {
    return ASSIGNABLE_SCREENS.map(({ path, label, section, feature, always }) => ({
      path,
      label,
      section,
      feature: feature ?? null,
      always: always ?? false,
    }));
  }

  @Get()
  list(@CurrentUser('organizationId') orgId: string) {
    return this.roles.list(orgId);
  }

  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateCustomRoleDto) {
    return this.roles.create(orgId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomRoleDto,
  ) {
    return this.roles.update(orgId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.roles.remove(orgId, id);
  }
}
