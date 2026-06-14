import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { PlatformFeature } from '@/common/enums/feature.enum';

/**
 * A subscription plan (pricing tier) offered to organizations.
 * Platform-level (not tenant-scoped) — managed by the Super Admin.
 */
@Entity('subscription_plans')
@Index(['code'], { unique: true })
export class SubscriptionPlan extends BaseEntity {
  @Column()
  name: string;

  /** Stable slug used in code/URLs, e.g. "starter". */
  @Column()
  code: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'price_monthly', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  priceMonthly: number;

  @Column({ name: 'price_yearly', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  priceYearly: number;

  /** Seat limit; null = unlimited. */
  @Column({ name: 'max_users', type: 'int', nullable: true })
  maxUsers: number | null;

  /** Branch limit; null = unlimited. */
  @Column({ name: 'max_branches', type: 'int', nullable: true })
  maxBranches: number | null;

  /** Feature keys enabled on this plan (see PlatformFeature). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  features: PlatformFeature[];

  /** Assigned to brand-new organizations at self-registration. */
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  /** Visible on the public pricing/registration screen. */
  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
