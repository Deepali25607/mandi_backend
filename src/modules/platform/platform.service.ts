import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlansService } from './plans.service';
import { UpdateOrganizationAdminDto } from './dto/platform.dto';
import { BillingCycle, SubscriptionStatus } from '@/common/enums/feature.enum';

export interface OrgUsage {
  users: number;
  branches: number;
  items: number;
  suppliers: number;
  customers: number;
  sales: number;
  arrivals: number;
  collections: number;
}

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>,
    private readonly plansService: PlansService,
    private readonly dataSource: DataSource,
  ) {}

  /** All tenants with subscription summary + headline counts. */
  async listOrganizations() {
    const orgs = await this.orgs.find({ relations: { plan: true }, order: { createdAt: 'DESC' } });
    return Promise.all(
      orgs.map(async (o) => ({
        id: o.id,
        name: o.name,
        email: o.email,
        mobile: o.mobile,
        gstNumber: o.gstNumber,
        isActive: o.isActive,
        planId: o.planId,
        planName: o.plan?.name ?? null,
        subscriptionStatus: o.subscriptionStatus,
        billingCycle: o.billingCycle,
        renewalDate: o.renewalDate,
        createdAt: o.createdAt,
        userCount: await this.users.count({ where: { organizationId: o.id } }),
        branchCount: await this.branches.count({ where: { organizationId: o.id } }),
      })),
    );
  }

  async getOrganization(id: string) {
    const org = await this.orgs.findOne({ where: { id }, relations: { plan: true } });
    if (!org) throw new NotFoundException('Organization not found');
    const usage = await this.usage(id);
    const admin = await this.users.findOne({
      where: { organizationId: id },
      order: { createdAt: 'ASC' },
    });
    return {
      id: org.id,
      name: org.name,
      email: org.email,
      mobile: org.mobile,
      gstNumber: org.gstNumber,
      address: org.address,
      isActive: org.isActive,
      planId: org.planId,
      plan: org.plan ?? null,
      subscriptionStatus: org.subscriptionStatus,
      billingCycle: org.billingCycle,
      subscriptionStart: org.subscriptionStart,
      renewalDate: org.renewalDate,
      createdAt: org.createdAt,
      primaryAdmin: admin ? { name: admin.name, username: admin.username, mobile: admin.mobile } : null,
      usage,
    };
  }

  async updateOrganization(id: string, dto: UpdateOrganizationAdminDto) {
    const org = await this.orgs.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    if (dto.planId !== undefined) {
      if (dto.planId) await this.plansService.findOne(dto.planId); // validate
      org.planId = dto.planId || null;
    }
    if (dto.isActive !== undefined) org.isActive = dto.isActive;
    if (dto.subscriptionStatus !== undefined) org.subscriptionStatus = dto.subscriptionStatus;
    if (dto.billingCycle !== undefined) org.billingCycle = dto.billingCycle;
    if (dto.renewalDate !== undefined) org.renewalDate = dto.renewalDate || null;

    await this.orgs.save(org);
    return this.getOrganization(id);
  }

  /** Platform-wide KPIs for the Super Admin dashboard. */
  async stats() {
    const orgs = await this.orgs.find({ relations: { plan: true } });
    const totalUsers = await this.users.count();

    const byStatus: Record<string, number> = {};
    for (const s of Object.values(SubscriptionStatus)) byStatus[s] = 0;
    const byPlan: { planId: string | null; planName: string; count: number }[] = [];
    const planIndex = new Map<string, number>();
    let mrr = 0;

    for (const o of orgs) {
      byStatus[o.subscriptionStatus] = (byStatus[o.subscriptionStatus] ?? 0) + 1;
      const key = o.planId ?? 'none';
      const name = o.plan?.name ?? 'Unassigned';
      if (!planIndex.has(key)) {
        planIndex.set(key, byPlan.length);
        byPlan.push({ planId: o.planId ?? null, planName: name, count: 0 });
      }
      byPlan[planIndex.get(key)!].count += 1;

      // Estimated recurring revenue (only billing active/trial subscriptions).
      if (o.plan && (o.subscriptionStatus === SubscriptionStatus.ACTIVE || o.subscriptionStatus === SubscriptionStatus.TRIAL)) {
        mrr += o.billingCycle === BillingCycle.YEARLY ? o.plan.priceYearly / 12 : o.plan.priceMonthly;
      }
    }

    const recent = orgs
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((o) => ({ id: o.id, name: o.name, planName: o.plan?.name ?? null, status: o.subscriptionStatus, createdAt: o.createdAt }));

    return {
      totalOrganizations: orgs.length,
      activeOrganizations: orgs.filter((o) => o.isActive).length,
      totalUsers,
      estimatedMrr: Math.round(mrr * 100) / 100,
      byStatus,
      byPlan,
      recentOrganizations: recent,
    };
  }

  private async usage(orgId: string): Promise<OrgUsage> {
    const count = async (table: string): Promise<number> => {
      const r = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM ${table} WHERE organization_id = $1`,
        [orgId],
      );
      return r?.[0]?.c ?? 0;
    };
    const [users, branches, items, suppliers, customers, sales, arrivals, collections] = await Promise.all([
      count('users'),
      count('branches'),
      count('items'),
      count('suppliers'),
      count('customers'),
      count('sales'),
      count('arrivals'),
      count('collections'),
    ]);
    return { users, branches, items, suppliers, customers, sales, arrivals, collections };
  }
}
