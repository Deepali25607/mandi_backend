import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 2: Customer Master (buyer / retailer). */
@Entity('customers')
@Index(['organizationId'])
@Index(['organizationId', 'code'], { unique: true })
export class Customer extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  mobile?: string;

  @Column({ nullable: true })
  area?: string;

  @Column({ name: 'gst_number', nullable: true })
  gstNumber?: string;

  @Column({ name: 'credit_limit', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  creditLimit: number;

  /** Opening ledger balance; positive = customer owes us (receivable). */
  @Column({ name: 'opening_balance', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  openingBalance: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
