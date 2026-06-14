import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { PaymentMode } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 11: Ugrahi (collection) — a payment received from a customer. */
@Entity('collections')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'customerId'])
@Index(['organizationId', 'collectionNumber'], { unique: true })
export class Collection extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'collection_number' })
  collectionNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ name: 'payment_mode', type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  paymentMode: PaymentMode;

  @Column({ nullable: true })
  reference?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
