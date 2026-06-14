import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { LotStatus } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/**
 * BRD Module 8: Lot-wise inventory. Each arrival line creates one lot,
 * mapped to its supplier. Sales draw down qty/weight available.
 */
@Entity('stock_lots')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'lotNumber'], { unique: true })
export class StockLot extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'lot_number' })
  lotNumber: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'arrival_id' })
  arrivalId: string;

  /** Cost rate per unit recorded at arrival. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  rate: number;

  @Column({ name: 'qty_arrived', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  qtyArrived: number;

  @Column({ name: 'weight_arrived', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  weightArrived: number;

  @Column({ name: 'qty_available', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  qtyAvailable: number;

  @Column({ name: 'weight_available', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  weightAvailable: number;

  @Column({ type: 'enum', enum: LotStatus, default: LotStatus.ACTIVE })
  status: LotStatus;

  @Column({ type: 'date' })
  date: string;
}
