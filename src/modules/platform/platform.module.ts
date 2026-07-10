import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionPayment } from './subscription-payment.entity';
import { PlatformSetting } from './platform-setting.entity';
import { PlansService } from './plans.service';
import { PlatformService } from './platform.service';
import { PlatformSettingsService } from './platform-settings.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { PlansController } from './plans.controller';
import { PlatformController } from './platform.controller';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      SubscriptionPayment,
      PlatformSetting,
      Organization,
      Branch,
      User,
    ]),
  ],
  providers: [
    PlansService,
    PlatformService,
    PlatformSettingsService,
    SubscriptionService,
    SubscriptionPaymentService,
  ],
  controllers: [PlansController, PlatformController, SubscriptionController],
  // SubscriptionService + PlansService are reused by AuthModule (token/feature
  // resolution); PlatformSettingsService for the configurable trial length.
  exports: [SubscriptionService, PlansService, PlatformSettingsService],
})
export class PlatformModule {}
