import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/organization.dto';
import { UpdateAppearanceDto } from './dto/appearance.dto';

@Controller('organization')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /** Current user's organization profile. */
  @Get()
  current(@CurrentUser('organizationId') orgId: string) {
    return this.organizations.findOne(orgId);
  }

  @Roles(Role.ORG_ADMIN)
  @Patch()
  update(@CurrentUser('organizationId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(orgId, dto);
  }

  /**
   * Theme & Wallpaper. The GET is open to every role in the org so the chosen
   * look-and-feel loads for all users; only the Org Admin may change it.
   */
  @Get('appearance')
  getAppearance(@CurrentUser('organizationId') orgId: string) {
    return this.organizations.getAppearance(orgId);
  }

  @Roles(Role.ORG_ADMIN)
  @Patch('appearance')
  updateAppearance(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: UpdateAppearanceDto,
  ) {
    return this.organizations.updateAppearance(orgId, dto);
  }
}
