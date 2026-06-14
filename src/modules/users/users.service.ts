import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@/common/enums/role.enum';
import { hashSecret, normalizeUsername } from '@/common/utils/password.util';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({ where: { username: normalizeUsername(username) } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  // ---- Admin management (org-scoped) ----

  list(organizationId: string): Promise<User[]> {
    return this.users.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  /**
   * Onboard a staff member. The admin sets an initial password; the user is
   * forced to change it on first login (mustChangePassword).
   */
  async create(
    organizationId: string,
    dto: {
      name: string;
      username: string;
      password: string;
      role: Role;
      branchId?: string | null;
      mobile?: string;
    },
  ): Promise<User> {
    const username = normalizeUsername(dto.username);
    const existing = await this.users.findOne({ where: { username } });
    if (existing) throw new ConflictException('Username already taken');

    const passwordHash = await hashSecret(dto.password);
    const user = await this.users.save(
      this.users.create({
        organizationId,
        branchId: dto.branchId ?? null,
        name: dto.name,
        username,
        mobile: dto.mobile,
        role: dto.role,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      }),
    );
    // Don't leak the hash back.
    delete (user as Partial<User>).passwordHash;
    return user;
  }

  async update(
    organizationId: string,
    id: string,
    dto: Partial<{ name: string; role: Role; branchId: string | null; isActive: boolean; mobile: string }>,
  ): Promise<User> {
    const user = await this.users.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    // Whitelist — username & password are never changed here (use reset-password).
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.branchId !== undefined) user.branchId = dto.branchId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.mobile !== undefined) user.mobile = dto.mobile;
    return this.users.save(user);
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
}
