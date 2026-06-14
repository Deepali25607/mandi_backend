import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { FEATURE_CATALOGUE } from '@/common/enums/feature.enum';
import { PlansService } from './plans.service';
import { PlatformSettingsService } from './platform-settings.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/platform.dto';

@Controller()
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly settings: PlatformSettingsService,
  ) {}

  /** Public pricing list for the registration screen. */
  @Public()
  @Get('plans/public')
  publicPlans() {
    return this.plans.findPublic();
  }

  /** Public login-screen branding (background, brand colour, app name/tagline). */
  @Public()
  @Get('branding/public')
  publicBranding() {
    return this.settings.getBranding();
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('platform/feature-catalogue')
  catalogue() {
    return FEATURE_CATALOGUE;
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('platform/plans')
  findAll() {
    return this.plans.findAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('platform/plans')
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('platform/plans/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }
}
