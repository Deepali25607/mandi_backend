import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/**
 * A configurable printer profile so ANY thermal/roll printer can be used, not
 * just the built-in 2"/3"/4" presets. Printing itself goes through the browser's
 * print dialog (which can reach any printer the OS has installed); what varies
 * per model is the paper geometry — so that's what we make configurable.
 */
@Entity('printer_profiles')
@Index(['organizationId'])
export class PrinterProfile extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  /** Display label, e.g. "Counter TVS RP3200" or "Godown 80mm". */
  @Column()
  name: string;

  /** Paper/roll width in mm (58 = 2", 80 = 3", 104 = 4"). */
  @Column({ name: 'width_mm', type: 'numeric', precision: 6, scale: 2, default: 80, transformer: NumericTransformer })
  widthMm: number;

  /** Base font size in px — smaller paper needs smaller type. */
  @Column({ name: 'font_size', type: 'numeric', precision: 4, scale: 1, default: 10.5, transformer: NumericTransformer })
  fontSize: number;

  /** Unprintable edge / padding in mm applied inside the paper width. */
  @Column({ name: 'margin_mm', type: 'numeric', precision: 4, scale: 1, default: 2, transformer: NumericTransformer })
  marginMm: number;

  /** Preselected in the print menu. At most one per organization. */
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
