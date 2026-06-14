import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Base columns shared by every entity: UUID PK + audit timestamps. */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Base for all tenant-scoped (transactional / master) data.
 * Per BRD Section 4, every record must carry Organization + Branch
 * for complete data isolation between tenants.
 *
 * NOTE: organizationId/branchId are kept as plain columns (not relations)
 * so the tenant filter can be applied cheaply on every query without joins.
 */
export abstract class TenantEntity extends BaseEntity {
  // organizationId and branchId are declared on each concrete entity so we
  // can index them per-table; this abstract class documents the contract.
}
