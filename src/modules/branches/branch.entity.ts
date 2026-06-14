import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Organization } from '@/modules/organizations/organization.entity';

/** BRD Module 1: Branch Management. A mandi branch under an organization. */
@Entity('branches')
@Index(['organizationId'])
export class Branch extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (org) => org.branches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column()
  name: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ name: 'contact_details', nullable: true })
  contactDetails?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
