import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/**
 * One row per price update — an append-only log. The "current" selling price of
 * an item is simply its newest row; nothing is ever overwritten, so the full
 * history (who changed what, from what, when) is always available.
 */
@Entity('item_prices')
@Index(['organizationId', 'itemId', 'createdAt'])
export class ItemPrice extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  /** Selling price per unit (₹/kg or the item's unit). */
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: NumericTransformer })
  price: number;

  /** The price this update replaced (null for the first ever price). */
  @Column({ name: 'previous_price', type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: NumericTransformer })
  previousPrice: number | null;

  /** Business date the rate applies from (defaults to the day it was set). */
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
