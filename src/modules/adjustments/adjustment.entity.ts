import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 5: the four supported adjustment kinds. */
export enum AdjustmentType {
  RATE_INCREASE = 'rate_increase',
  RATE_DECREASE = 'rate_decrease',
  WEIGHT_INCREASE = 'weight_increase',
  WEIGHT_DECREASE = 'weight_decrease',
}

/**
 * BRD Module 5: Rate & Weight Adjustment (special mandi requirement).
 * Captures the difference between the actual customer-side figure and the
 * value reported to the supplier, as a signed effect on the supplier's payable.
 *
 * `amount` > 0 increases what we owe the supplier; < 0 decreases it.
 * (e.g. reported supplier price ₹1100 vs actual ₹1000 → amount +100.)
 * Customer-side records are unchanged — supplier & customer ledgers stay separate.
 */
@Entity('adjustments')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'supplierId'])
@Index(['organizationId', 'adjustmentNumber'], { unique: true })
export class Adjustment extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'adjustment_number' })
  adjustmentNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  /** Actual customer-side figure (rate or weight value, for the record). */
  @Column({ name: 'actual_value', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  actualValue: number;

  /** Value reported to the supplier. */
  @Column({ name: 'reported_value', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  reportedValue: number;

  /** Signed ₹ effect on the supplier's payable. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
