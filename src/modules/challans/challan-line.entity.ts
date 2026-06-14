import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { Challan } from './challan.entity';

/** A line on a for-sale challan; draws stock from a specific lot. */
@Entity('challan_lines')
@Index(['challanId'])
export class ChallanLine extends BaseEntity {
  @Column({ name: 'challan_id' })
  challanId: string;

  @ManyToOne(() => Challan, (challan) => challan.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan: Challan;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  weight: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  rate: number;
}
