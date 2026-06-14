import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { PlatformFeature, SubscriptionStatus } from '@/common/enums/feature.enum';

/** Resolved subscription context attached to a request principal. */
export interface OrgSubscriptionContext {
  organizationActive: boolean;
  planId: string | null;
  planName: string | null;
  status: SubscriptionStatus | null;
  renewalDate: string | null;
  features: PlatformFeature[];
}

/**
 * Resolves an organization's effective feature set from its subscription plan.
 * Shared by auth (token issuance / JWT validation) and the FeatureGuard.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
  ) {}

  async resolveContext(organizationId: string | null): Promise<OrgSubscriptionContext> {
    if (!organizationId) {
      // Platform-level principal (Super Admin) — no tenant subscription.
      return { organizationActive: true, planId: null, planName: null, status: null, renewalDate: null, features: [] };
    }
    const org = await this.orgs.findOne({ where: { id: organizationId }, relations: { plan: true } });
    if (!org) {
      return { organizationActive: false, planId: null, planName: null, status: null, renewalDate: null, features: [] };
    }
    // Suspended/expired/cancelled subscriptions expose no plan features.
    const entitled = org.subscriptionStatus === SubscriptionStatus.ACTIVE || org.subscriptionStatus === SubscriptionStatus.TRIAL;
    const features = entitled && org.plan?.isActive ? (org.plan.features ?? []) : [];
    return {
      organizationActive: org.isActive,
      planId: org.planId,
      planName: org.plan?.name ?? null,
      status: org.subscriptionStatus,
      renewalDate: org.renewalDate,
      features,
    };
  }
}
