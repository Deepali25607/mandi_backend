import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { BillingCycle, SubscriptionStatus } from '@/common/enums/feature.enum';
import { SubscriptionPlan } from './subscription-plan.entity';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from './subscription-payment.entity';
import { SubscriptionService } from './subscription.service';
import { PlatformSettingsService } from './platform-settings.service';
import { RequestSubscriptionPaymentDto } from './dto/subscription-payment.dto';

const toDate = (d: Date) => d.toISOString().slice(0, 10);

function addCycle(base: Date, cycle: BillingCycle): Date {
  const d = new Date(base);
  if (cycle === BillingCycle.YEARLY) d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

@Injectable()
export class SubscriptionPaymentService {
  constructor(
    @InjectRepository(SubscriptionPayment) private readonly payments: Repository<SubscriptionPayment>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>,
    private readonly subscriptions: SubscriptionService,
    private readonly settings: PlatformSettingsService,
  ) {}

  // ---- Tenant (org admin) ----

  /** Current subscription state + payment history + how/where to pay. */
  async getMine(organizationId: string) {
    const ctx = await this.subscriptions.resolveContext(organizationId);
    const org = await this.orgs.findOne({ where: { id: organizationId }, relations: { plan: true } });
    if (!org) throw new NotFoundException('Organization not found');

    const today = new Date().toISOString().slice(0, 10);
    const daysLeft = org.renewalDate
      ? Math.round((new Date(org.renewalDate).getTime() - new Date(today).getTime()) / 86_400_000)
      : null;

    const priceMonthly = org.plan?.priceMonthly ?? 0;
    const priceYearly = org.plan?.priceYearly ?? 0;
    const amountDue = org.billingCycle === BillingCycle.YEARLY ? priceYearly : priceMonthly;

    const [instructions, upi, bank, supportEmail, supportMobile] = await Promise.all([
      this.settings.getValue('payment_instructions'),
      this.settings.getValue('payment_upi'),
      this.settings.getValue('payment_bank'),
      this.settings.getValue('support_email'),
      this.settings.getValue('support_mobile'),
    ]);

    const history = await this.payments.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });

    return {
      organizationId,
      planId: org.planId,
      planName: org.plan?.name ?? null,
      status: ctx.status,
      locked: ctx.locked,
      renewalDate: org.renewalDate,
      daysLeft,
      billingCycle: org.billingCycle,
      priceMonthly,
      priceYearly,
      amountDue,
      paymentInstructions: instructions,
      paymentUpi: upi,
      paymentBank: bank,
      supportEmail,
      supportMobile,
      payments: history,
    };
  }

  /** Submit a manual payment for the platform admin to review. */
  async request(organizationId: string, userId: string, dto: RequestSubscriptionPaymentDto) {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const pending = await this.payments.findOne({
      where: { organizationId, status: SubscriptionPaymentStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException('A payment is already awaiting review. Please wait for it to be processed.');
    }

    let planId = dto.planId ?? org.planId ?? null;
    if (planId) {
      const plan = await this.plans.findOne({ where: { id: planId } });
      if (!plan) throw new BadRequestException('Selected plan does not exist');
    }

    const payment = this.payments.create({
      organizationId,
      planId,
      amount: dto.amount,
      billingCycle: dto.billingCycle,
      method: dto.method,
      reference: dto.reference,
      note: dto.note,
      status: SubscriptionPaymentStatus.PENDING,
      requestedBy: userId,
    });
    return this.payments.save(payment);
  }

  // ---- Platform (super admin) ----

  /** All payment requests (newest first), optionally filtered by status. */
  async listAll(status?: SubscriptionPaymentStatus) {
    const rows = await this.payments.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
    // Attach org + plan names for the review console.
    const orgIds = [...new Set(rows.map((r) => r.organizationId))];
    const orgs = orgIds.length
      ? await this.orgs.find({ where: { id: In(orgIds) }, relations: { plan: true } })
      : [];
    const orgMap = new Map(orgs.map((o) => [o.id, o]));
    return rows.map((r) => {
      const org = orgMap.get(r.organizationId);
      return {
        ...r,
        organizationName: org?.name ?? null,
        organizationStatus: org?.subscriptionStatus ?? null,
        organizationRenewalDate: org?.renewalDate ?? null,
      };
    });
  }

  /** Approve a payment: mark it, set the org ACTIVE and extend its renewal date. */
  async approve(paymentId: string, reviewerId: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== SubscriptionPaymentStatus.PENDING) {
      throw new ConflictException('This payment has already been reviewed.');
    }
    const org = await this.orgs.findOne({ where: { id: payment.organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    // Extend from the later of today or the current (future) renewal date so a
    // customer who renews early is not penalised.
    const today = new Date();
    const todayStr = toDate(today);
    const base = org.renewalDate && org.renewalDate > todayStr ? new Date(org.renewalDate) : today;
    const newRenewal = addCycle(base, payment.billingCycle);

    org.subscriptionStatus = SubscriptionStatus.ACTIVE;
    org.isActive = true;
    org.billingCycle = payment.billingCycle;
    if (payment.planId) org.planId = payment.planId;
    if (!org.subscriptionStart) org.subscriptionStart = todayStr;
    org.renewalDate = toDate(newRenewal);
    await this.orgs.save(org);

    payment.status = SubscriptionPaymentStatus.APPROVED;
    payment.reviewedBy = reviewerId;
    payment.reviewedAt = today;
    payment.periodStart = toDate(base);
    payment.periodEnd = org.renewalDate;
    return this.payments.save(payment);
  }

  /** Reject a payment (org stays in its current state). */
  async reject(paymentId: string, reviewerId: string, reviewNote?: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== SubscriptionPaymentStatus.PENDING) {
      throw new ConflictException('This payment has already been reviewed.');
    }
    payment.status = SubscriptionPaymentStatus.REJECTED;
    payment.reviewedBy = reviewerId;
    payment.reviewedAt = new Date();
    payment.reviewNote = reviewNote;
    return this.payments.save(payment);
  }
}
