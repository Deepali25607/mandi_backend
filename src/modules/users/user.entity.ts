import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Role } from '@/common/enums/role.enum';

/**
 * Application user. Belongs to an organization (except SUPER_ADMIN, which is
 * platform-level and has organizationId = null) and optionally a default branch.
 * Login is by username + password (self-contained; no external auth provider).
 */
@Entity('users')
@Index(['username'], { unique: true })
@Index(['organizationId'])
export class User extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column()
  name: string;

  /** Unique login handle (case-insensitive; stored lower-cased). */
  @Column()
  username: string;

  @Column({ nullable: true })
  mobile?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.SALES_OPERATOR,
  })
  role: Role;

  /** bcrypt hash of the password. Never selected by default. */
  @Column({ name: 'password_hash', nullable: true, select: false })
  passwordHash?: string;

  /** Forces a password change on next login (e.g. after admin onboarding/reset). */
  @Column({ name: 'must_change_password', default: false })
  mustChangePassword: boolean;

  /** Optional self-service recovery (no email/SMS): a security question + hashed answer. */
  @Column({ name: 'security_question', nullable: true })
  securityQuestion?: string;

  @Column({ name: 'security_answer_hash', nullable: true, select: false })
  securityAnswerHash?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
