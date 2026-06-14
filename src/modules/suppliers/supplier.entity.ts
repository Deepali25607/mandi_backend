import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { CommissionType } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 2: Supplier Master (farmer / commission-agent supplier). */
@Entity('suppliers')
@Index(['organizationId'])
@Index(['organizationId', 'code'], { unique: true })
export class Supplier extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  village?: string;

  @Column({ nullable: true })
  mobile?: string;

  @Column({ name: 'commission_type', type: 'enum', enum: CommissionType, default: CommissionType.PERCENTAGE })
  commissionType: CommissionType;

  /** Commission rate: a percentage, or a fixed amount per kg depending on type. */
  @Column({ name: 'commission_rate', type: 'numeric', precision: 8, scale: 2, default: 0, transformer: NumericTransformer })
  commissionRate: number;

  @Column({ name: 'bank_name', nullable: true })
  bankName?: string;

  @Column({ name: 'bank_account', nullable: true })
  bankAccount?: string;

  @Column({ name: 'bank_ifsc', nullable: true })
  bankIfsc?: string;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl?: string;

  /** Opening ledger balance; positive = we owe the supplier (payable). */
  @Column({ name: 'opening_balance', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  openingBalance: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
