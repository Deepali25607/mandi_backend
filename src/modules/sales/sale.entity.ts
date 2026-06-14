import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { PaymentMode } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { SaleLine } from './sale-line.entity';

/** BRD Module 4: Daily Sale Entry header (single-window sale to a customer). */
@Entity('sales')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'saleNumber'], { unique: true })
export class Sale extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'sale_number' })
  saleNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'payment_mode', type: 'enum', enum: PaymentMode, default: PaymentMode.CREDIT })
  paymentMode: PaymentMode;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;

  @Column({ nullable: true })
  notes?: string;

  /** Sum of line gross = amount the customer is billed. */
  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  grossAmount: number;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  commissionAmount: number;

  @Column({ name: 'market_fee_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  marketFeeAmount: number;

  /** Net to supplier = gross − commission − market fee (adhati settlement basis). */
  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  netAmount: number;

  @OneToMany(() => SaleLine, (line) => line.sale, { cascade: true })
  lines: SaleLine[];
}
