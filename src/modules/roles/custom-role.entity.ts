import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

/**
 * An organization-defined role: a named bundle of screens an Org Admin can
 * assign to their staff instead of one of the fixed built-in roles.
 *
 * `screens` is the list of granted screen paths (see common/config/screens.ts).
 * The effective backend capabilities are derived from these screens at auth
 * time, so this entity stays the single source of truth for what the role can do.
 */
@Entity('custom_roles')
@Index(['organizationId'])
export class CustomRole extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  /** Granted screen paths (e.g. ['/sales', '/customers']). */
  @Column({ name: 'screens', type: 'simple-array', default: '' })
  screens: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
