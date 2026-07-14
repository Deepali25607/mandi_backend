import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/**
 * A bank account an organization keeps money in. Bank-linked receipts/payments
 * (UPI, Bank Transfer) can be routed to a specific account so cash and bank
 * balances reconcile separately from Cash in Hand.
 */
@Entity('bank_accounts')
@Index(['organizationId'])
export class BankAccount extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  /** Optional branch scoping; null = available to the whole organization. */
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  /** Display label, e.g. "HDFC Current" or "Owner's UPI". */
  @Column()
  name: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName?: string;

  @Column({ name: 'account_number', nullable: true })
  accountNumber?: string;

  /** Balance already in the account before app transactions began. */
  @Column({ name: 'opening_balance', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  openingBalance: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
