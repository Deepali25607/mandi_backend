import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLE_LABELS, Role } from '@/common/enums/role.enum';
import { hashSecret, normalizeUsername } from '@/common/utils/password.util';
import { CustomRolesService } from '@/modules/roles/custom-roles.service';
import { User } from './user.entity';

/** User shape returned to the admin UI, with the effective role label resolved. */
export type ManagedUserView = Omit<User, 'passwordHash' | 'securityAnswerHash'> & {
  roleLabel: string;
  customRoleName: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly customRoles: CustomRolesService,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({ where: { username: normalizeUsername(username) } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  // ---- Admin management (org-scoped) ----

  async list(organizationId: string): Promise<ManagedUserView[]> {
    const [users, roles] = await Promise.all([
      this.users.find({ where: { organizationId }, order: { name: 'ASC' } }),
      this.customRoles.list(organizationId),
    ]);
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    return Promise.all(users.map((u) => this.toView(u, roleName)));
  }

  /**
   * Onboard a staff member. The admin sets an initial password; the user is
   * forced to change it on first login (mustChangePassword). Either a built-in
   * `role` or a `customRoleId` must be supplied.
   */
  async create(
    organizationId: string,
    dto: {
      name: string;
      username: string;
      password: string;
      role?: Role;
      customRoleId?: string | null;
      branchId?: string | null;
      mobile?: string;
    },
  ): Promise<ManagedUserView> {
    const username = normalizeUsername(dto.username);
    const existing = await this.users.findOne({ where: { username } });
    if (existing) throw new ConflictException('Username already taken');

    const { role, customRoleId } = await this.resolveAssignment(organizationId, dto.role, dto.customRoleId);

    const passwordHash = await hashSecret(dto.password);
    const saved = await this.users.save(
      this.users.create({
        organizationId,
        branchId: dto.branchId ?? null,
        name: dto.name,
        username,
        mobile: dto.mobile,
        role,
        customRoleId,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      }),
    );
    return this.toView(saved);
  }

  async update(
    organizationId: string,
    id: string,
    dto: Partial<{
      name: string;
      role: Role;
      customRoleId: string | null;
      branchId: string | null;
      isActive: boolean;
      mobile: string;
    }>,
  ): Promise<ManagedUserView> {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    // Whitelist — username & password are never changed here (use reset-password).
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.branchId !== undefined) user.branchId = dto.branchId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.mobile !== undefined) user.mobile = dto.mobile;

    // Role change: a non-empty customRoleId assigns a custom role; otherwise a
    // built-in `role` switches back to (or between) fixed roles.
    if (dto.customRoleId) {
      const { role, customRoleId } = await this.resolveAssignment(organizationId, dto.role, dto.customRoleId);
      user.customRoleId = customRoleId;
      if (dto.role !== undefined) user.role = role;
    } else if (dto.role !== undefined || dto.customRoleId === null) {
      const { role, customRoleId } = await this.resolveAssignment(organizationId, dto.role ?? user.role, null);
      user.role = role;
      user.customRoleId = customRoleId;
    }

    const saved = await this.users.save(user);
    return this.toView(saved);
  }

  /** Admin resets a user's password to a new temporary one (force change on next login). */
  async resetPassword(organizationId: string, id: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    user.passwordHash = await hashSecret(newPassword);
    user.mustChangePassword = true;
    await this.users.save(user);
    return { message: 'Password reset. The user must change it on next login.' };
  }

  /** Normalizes a role assignment: custom role wins, else built-in, else error. */
  private async resolveAssignment(
    organizationId: string,
    role: Role | undefined,
    customRoleId: string | null | undefined,
  ): Promise<{ role: Role; customRoleId: string | null }> {
    if (customRoleId) {
      const custom = await this.customRoles.findOne(organizationId, customRoleId);
      if (!custom.isActive) throw new BadRequestException('That custom role is disabled. Enable it first.');
      // Keep a stored fallback role; access comes from the custom role.
      return { role: role ?? Role.SALES_OPERATOR, customRoleId };
    }
    if (role) return { role, customRoleId: null };
    throw new BadRequestException('Choose a built-in role or a custom role for this user.');
  }

  private async toView(user: User, roleName?: Map<string, string>): Promise<ManagedUserView> {
    let customRoleName: string | null = null;
    if (user.customRoleId) {
      customRoleName = roleName?.get(user.customRoleId) ?? null;
      if (customRoleName === null && user.organizationId) {
        // Single-user path (create/update): fetch the name directly.
        const role = await this.customRoles.findOne(user.organizationId, user.customRoleId).catch(() => null);
        customRoleName = role?.name ?? null;
      }
    }
    const view = { ...user, roleLabel: customRoleName ?? ROLE_LABELS[user.role], customRoleName };
    delete (view as Partial<User>).passwordHash;
    delete (view as Partial<User>).securityAnswerHash;
    return view as ManagedUserView;
  }
}
