import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { PaymentMode } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** A payment made TO a supplier (settles supplier payable). */
@Entity('supplier_payments')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'supplierId'])
@Index(['organizationId', 'paymentNumber'], { unique: true })
export class SupplierPayment extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'payment_number' })
  paymentNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ name: 'payment_mode', type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  paymentMode: PaymentMode;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ nullable: true })
  reference?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
