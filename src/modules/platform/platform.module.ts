import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlatformSetting } from './platform-setting.entity';
import { PlansService } from './plans.service';
import { PlatformService } from './platform.service';
import { PlatformSettingsService } from './platform-settings.service';
import { SubscriptionService } from './subscription.service';
import { PlansController } from './plans.controller';
import { PlatformController } from './platform.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPlan, PlatformSetting, Organization, Branch, User]),
  ],
  providers: [PlansService, PlatformService, PlatformSettingsService, SubscriptionService],
  controllers: [PlansController, PlatformController],
  // SubscriptionService + PlansService are reused by AuthModule (token/feature resolution).
  exports: [SubscriptionService, PlansService],
})
export class PlatformModule {}
