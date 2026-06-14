import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { ItemCategory } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 2: Item Master. Org-level master shared across branches. */
@Entity('items')
@Index(['organizationId'])
@Index(['organizationId', 'code'], { unique: true })
export class Item extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ItemCategory, default: ItemCategory.VEGETABLES })
  category: ItemCategory;

  /** Unit of measure for rate (e.g. kg, crate, dozen). */
  @Column({ default: 'kg' })
  unit: string;

  @Column({
    name: 'default_commission_pct',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  defaultCommissionPct: number;

  @Column({
    name: 'default_market_fee_pct',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  defaultMarketFeePct: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
