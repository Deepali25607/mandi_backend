import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { TransferDirection } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/**
 * An internal fund transfer between Cash in Hand and a bank account (a contra
 * voucher). It moves money between the org's own cash and bank; it never touches
 * any customer/supplier ledger.
 */
@Entity('cash_transfers')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'transferNumber'], { unique: true })
export class CashTransfer extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'transfer_number' })
  transferNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'direction', type: 'enum', enum: TransferDirection })
  direction: TransferDirection;

  /** The bank account involved (credited for deposits, debited for withdrawals). */
  @Column({ name: 'bank_account_id', type: 'uuid' })
  bankAccountId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
