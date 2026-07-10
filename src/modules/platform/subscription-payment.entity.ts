import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { BillingCycle } from '@/common/enums/feature.enum';

/** Review state of a manually-submitted subscription payment. */
export enum SubscriptionPaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** How the tenant paid (offline / manual — no gateway). */
export enum SubscriptionPaymentMethod {
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
  CHEQUE = 'cheque',
  OTHER = 'other',
}

/**
 * A manual subscription payment an organization submits for review. There is no
 * online payment gateway: the tenant pays offline (UPI/bank/cash), records the
 * reference here, and the platform Super Admin approves it to extend the plan.
 *
 * Platform-level (keyed by organizationId but NOT tenant-guarded like the ERP's
 * operational data — do not confuse with SupplierPayment / Collection).
 */
@Entity('subscription_payments')
@Index(['organizationId'])
export class SubscriptionPayment extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** Plan the tenant is paying for (defaults to the org's current plan). */
  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ name: 'billing_cycle', type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @Column({ type: 'enum', enum: SubscriptionPaymentMethod, default: SubscriptionPaymentMethod.UPI })
  method: SubscriptionPaymentMethod;

  /** UPI txn id / bank UTR / cheque number etc. */
  @Column({ nullable: true })
  reference?: string;

  @Column({ nullable: true })
  note?: string;

  @Column({ type: 'enum', enum: SubscriptionPaymentStatus, default: SubscriptionPaymentStatus.PENDING })
  status: SubscriptionPaymentStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_note', nullable: true })
  reviewNote?: string;

  // Subscription window granted when this payment is approved.
  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: string | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: string | null;
}
