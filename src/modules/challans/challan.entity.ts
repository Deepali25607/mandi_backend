import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { ChallanLine } from './challan-line.entity';

export enum ChallanStatus {
  TRANSFERRED = 'transferred', // stock sent to the other agent
  REPORTED = 'reported', // bikri (sale) report received
  SETTLED = 'settled', // money settled
}

/**
 * BRD Module 9: For-Sale Challan. Stock is transferred to another commission
 * agent who sells it and reports back (bikri report), then settles.
 */
@Entity('challans')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'challanNumber'], { unique: true })
export class Challan extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'challan_number' })
  challanNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'agent_name' })
  agentName: string;

  @Column({ name: 'vehicle_number', nullable: true })
  vehicleNumber?: string;

  @Column({ type: 'enum', enum: ChallanStatus, default: ChallanStatus.TRANSFERRED })
  status: ChallanStatus;

  @Column({ name: 'total_quantity', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  totalQuantity: number;

  @Column({ name: 'total_weight', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  totalWeight: number;

  /** Cost value of the transferred stock (for reference). */
  @Column({ name: 'cost_value', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  costValue: number;

  // ---- Bikri report (filled on report) ----
  @Column({ name: 'reported_sale_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  reportedSaleAmount: number;

  @Column({ name: 'agent_commission', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  agentCommission: number;

  @Column({ name: 'other_charges', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  otherCharges: number;

  @Column({ name: 'net_receivable', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  netReceivable: number;

  // ---- Settlement ----
  @Column({ name: 'settled_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  settledAmount: number;

  @Column({ name: 'settled_date', type: 'date', nullable: true })
  settledDate: string | null;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;

  @OneToMany(() => ChallanLine, (line) => line.challan, { cascade: true })
  lines: ChallanLine[];
}
