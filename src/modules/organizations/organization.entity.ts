import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { SubscriptionPlan } from '@/modules/platform/subscription-plan.entity';
import { BillingCycle, SubscriptionStatus } from '@/common/enums/feature.enum';

/** BRD Module 1: Organization Master. Top-level tenant. */
@Entity('organizations')
export class Organization extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'gst_number', nullable: true })
  gstNumber?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  mobile?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // --- Subscription (managed by the platform Super Admin) ---

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @ManyToOne(() => SubscriptionPlan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'plan_id' })
  plan?: SubscriptionPlan | null;

  @Column({
    name: 'subscription_status',
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  subscriptionStatus: SubscriptionStatus;

  @Column({ name: 'billing_cycle', type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @Column({ name: 'subscription_start', type: 'date', nullable: true })
  subscriptionStart: string | null;

  @Column({ name: 'renewal_date', type: 'date', nullable: true })
  renewalDate: string | null;

  // --- Appearance (Theme & Wallpaper, managed by the Org Admin) ---
  // Stored as a single JSON blob so the look-and-feel applies to every user
  // in the tenant. null until the admin customises it (frontend falls back
  // to the built-in default theme).
  @Column({ type: 'jsonb', nullable: true })
  appearance: AppearanceConfig | null;

  @OneToMany(() => Branch, (branch) => branch.organization)
  branches: Branch[];
}

/** Shape of the per-organization Theme & Wallpaper configuration. */
export interface AppearanceConfig {
  primaryColor: string;
  secondaryColor: string;
  mode: 'light' | 'dark';
  borderRadius: number;
  sidebar: 'default' | 'dark' | 'primary' | 'accent';
  wallpaper: {
    type: 'none' | 'color' | 'gradient' | 'image';
    value: string;
    opacity: number;
  };
}

/** Built-in default look returned when a tenant has not customised it. */
export const DEFAULT_APPEARANCE: AppearanceConfig = {
  primaryColor: '#1f8a4c',
  secondaryColor: '#f0a500',
  mode: 'light',
  borderRadius: 14,
  sidebar: 'default',
  wallpaper: { type: 'none', value: '', opacity: 0.5 },
};
