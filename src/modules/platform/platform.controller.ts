import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { PlatformService } from './platform.service';
import { PlatformSettingsService } from './platform-settings.service';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { SubscriptionPaymentStatus } from './subscription-payment.entity';
import { UpdateBrandingDto, UpdateOrganizationAdminDto, UpdateSettingDto } from './dto/platform.dto';
import { ReviewSubscriptionPaymentDto } from './dto/subscription-payment.dto';

/** Super Admin platform console. Org operational data is NOT exposed here. */
@Roles(Role.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly settings: PlatformSettingsService,
    private readonly subscriptionPayments: SubscriptionPaymentService,
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

  // --- Manual subscription payments (review & approve) ---
  @Get('payments')
  listPayments(@Query('status') status?: SubscriptionPaymentStatus) {
    return this.subscriptionPayments.listAll(status);
  }

  @Post('payments/:id/approve')
  approvePayment(@Param('id') id: string, @CurrentUser('id') reviewerId: string) {
    return this.subscriptionPayments.approve(id, reviewerId);
  }

  @Post('payments/:id/reject')
  rejectPayment(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewSubscriptionPaymentDto,
  ) {
    return this.subscriptionPayments.reject(id, reviewerId, dto.reviewNote);
  }

  // --- Login-screen branding (background, brand colour, app name) ---
  @Get('branding')
  getBranding() {
    return this.settings.getBranding();
  }

  @Patch('branding')
  updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.settings.setBranding(dto);
  }
}
