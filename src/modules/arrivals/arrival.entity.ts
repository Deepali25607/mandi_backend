import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { ArrivalLine } from './arrival-line.entity';

/** BRD Module 3: Arrival Entry header (goods received from a supplier). */
@Entity('arrivals')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'arrivalNumber'], { unique: true })
export class Arrival extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'arrival_number' })
  arrivalNumber: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'vehicle_number', nullable: true })
  vehicleNumber?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'total_quantity', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  totalQuantity: number;

  @Column({ name: 'total_weight', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  totalWeight: number;

  @Column({ name: 'total_value', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  totalValue: number;

  @OneToMany(() => ArrivalLine, (line) => line.arrival, { cascade: true })
  lines: ArrivalLine[];
}
