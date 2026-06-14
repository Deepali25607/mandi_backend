import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

/**
 * Platform-wide configuration as simple key/value rows.
 * Managed by the Super Admin (e.g. platform name, support email, default trial days).
 */
@Entity('platform_settings')
@Index(['key'], { unique: true })
export class PlatformSetting extends BaseEntity {
  @Column()
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @Column({ nullable: true })
  label?: string;
}
