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

  /**
   * Bill this payment settles. For an advance this is null until the lot is
   * settled, then it is stamped with the bill the advance was adjusted on.
   */
  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  /**
   * Advance payment: the stock lot (arrival line) this money was paid against.
   * When that lot is settled, the advance is adjusted on the bill date-wise.
   */
  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ nullable: true })
  reference?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
