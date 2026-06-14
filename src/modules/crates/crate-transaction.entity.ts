import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

export enum CrateParty {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
}

/** Direction relative to our mandi premises. */
export enum CrateDirection {
  OUT = 'out', // crates leaving us (issued to a customer / returned to a supplier)
  IN = 'in', // crates arriving (returned by a customer / received from a supplier)
}

/** BRD Module 10: Crate movement ledger. */
@Entity('crate_transactions')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'partyType', 'partyId'])
export class CrateTransaction extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'party_type', type: 'enum', enum: CrateParty })
  partyType: CrateParty;

  @Column({ name: 'party_id' })
  partyId: string;

  @Column({ type: 'enum', enum: CrateDirection })
  direction: CrateDirection;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  damaged: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
