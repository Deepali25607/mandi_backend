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
  /**
   * True when the trial/subscription has lapsed (expired/suspended/cancelled, or
   * a trial/active plan whose renewal date has passed). A locked org is put into
   * a read-only state by SubscriptionLockGuard until payment is confirmed.
   */
  locked: boolean;
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
      return { organizationActive: true, planId: null, planName: null, status: null, renewalDate: null, locked: false, features: [] };
    }
    const org = await this.orgs.findOne({ where: { id: organizationId }, relations: { plan: true } });
    if (!org) {
      return { organizationActive: false, planId: null, planName: null, status: null, renewalDate: null, locked: true, features: [] };
    }
    // A trial or active plan is entitled only until its renewal date passes.
    // ISO date strings ("YYYY-MM-DD") compare chronologically as plain strings.
    const today = new Date().toISOString().slice(0, 10);
    const expiredByDate = !!org.renewalDate && org.renewalDate < today;
    const statusOk =
      org.subscriptionStatus === SubscriptionStatus.ACTIVE ||
      org.subscriptionStatus === SubscriptionStatus.TRIAL;
    const entitled = statusOk && !expiredByDate;
    // Locked = read-only. `organizationActive` (org.isActive) stays a separate,
    // harder switch used to block LOGIN entirely; expiry only makes it read-only.
    const locked = !org.isActive || !entitled;
    const features = entitled && org.plan?.isActive ? (org.plan.features ?? []) : [];
    return {
      organizationActive: org.isActive,
      planId: org.planId,
      planName: org.plan?.name ?? null,
      status: org.subscriptionStatus,
      renewalDate: org.renewalDate,
      locked,
      features,
    };
  }
}
