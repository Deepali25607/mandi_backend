import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';
import { Sale } from './sale.entity';

/** A single item line on a sale; optionally drawn from a specific stock lot. */
@Entity('sale_lines')
@Index(['saleId'])
export class SaleLine extends BaseEntity {
  @Column({ name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => Sale, (sale) => sale.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ name: 'item_id' })
  itemId: string;

  /** Lot the goods were sold from (drives inventory drawdown). Null = no lot link. */
  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  weight: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: NumericTransformer })
  rate: number;

  @Column({ name: 'commission_pct', type: 'numeric', precision: 6, scale: 2, default: 0, transformer: NumericTransformer })
  commissionPct: number;

  @Column({ name: 'market_fee_pct', type: 'numeric', precision: 6, scale: 2, default: 0, transformer: NumericTransformer })
  marketFeePct: number;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  grossAmount: number;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  commissionAmount: number;

  @Column({ name: 'market_fee_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  marketFeeAmount: number;

  @Column({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  netAmount: number;
}
