import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

export enum SupplierBillStatus {
  FINALISED = 'finalised',
  PAID = 'paid',
}

/**
 * BRD Module 6: Supplier Bill / Settlement.
 * Aggregates a supplier's sold-lot figures over a date range, then applies
 * settlement deductions. netPayable = grossSales − commission − marketFee
 * − labour − crate − other.
 */
@Entity('supplier_bills')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'supplierId'])
@Index(['organizationId', 'billNumber'], { unique: true })
export class SupplierBill extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'bill_number' })
  billNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'from_date', type: 'date' })
  fromDate: string;

  @Column({ name: 'to_date', type: 'date' })
  toDate: string;

  @Column({ name: 'gross_sales', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  grossSales: number;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  commissionAmount: number;

  @Column({ name: 'market_fee_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  marketFeeAmount: number;

  @Column({ name: 'labour_charges', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  labourCharges: number;

  @Column({ name: 'crate_charges', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  crateCharges: number;

  @Column({ name: 'other_charges', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  otherCharges: number;

  @Column({ name: 'net_payable', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  netPayable: number;

  @Column({ type: 'enum', enum: SupplierBillStatus, default: SupplierBillStatus.FINALISED })
  status: SupplierBillStatus;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
