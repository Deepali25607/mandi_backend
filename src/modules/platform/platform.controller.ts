import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { PlatformService } from './platform.service';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdateOrganizationAdminDto, UpdateSettingDto } from './dto/platform.dto';

/** Super Admin platform console. Org operational data is NOT exposed here. */
@Roles(Role.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly settings: PlatformSettingsService,
  ) {}

  @Get('stats')
  stats() {
    return this.platform.stats();
  }

  @Get('organizations')
  listOrganizations() {
    return this.platform.listOrganizations();
  }

  @Get('organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this.platform.getOrganization(id);
  }

  @Patch('organizations/:id')
  updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationAdminDto) {
    return this.platform.updateOrganization(id, dto);
  }

  @Get('settings')
  getSettings() {
    return this.settings.findAll();
  }

  @Patch('settings/:key')
  updateSetting(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settings.update(key, dto.value);
  }
}
