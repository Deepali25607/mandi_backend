import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { Arrival } from './arrival.entity';

/** A single item line on an arrival; each line spawns one stock lot. */
@Entity('arrival_lines')
@Index(['arrivalId'])
export class ArrivalLine extends BaseEntity {
  @Column({ name: 'arrival_id' })
  arrivalId: string;

  @ManyToOne(() => Arrival, (arrival) => arrival.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'arrival_id' })
  arrival: Arrival;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'lot_number' })
  lotNumber: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  weight: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  rate: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;
}
