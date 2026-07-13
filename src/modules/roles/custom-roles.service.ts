import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLE_LABELS, Role } from '@/common/enums/role.enum';
import { ALWAYS_SCREEN_PATHS, capabilitiesForScreens, sanitizeScreens } from '@/common/config/screens';
import { User } from '@/modules/users/user.entity';
import { CustomRole } from './custom-role.entity';
import { CreateCustomRoleDto, UpdateCustomRoleDto } from './dto/custom-role.dto';

/** Effective access resolved for a principal (built-in role or custom role). */
export interface ResolvedGrants {
  /** Built-in capability roles used by RolesGuard to authorize writes. */
  grantedRoles: Role[];
  /** Granted screen paths — set only for custom-role users (drives the frontend nav). */
  grantedScreens?: string[];
  /** Display label (built-in role label, or the custom role's name). */
  roleLabel: string;
  /** The custom role's name, if the user is on a custom role. */
  customRoleName: string | null;
}

@Injectable()
export class CustomRolesService {
  constructor(
    @InjectRepository(CustomRole) private readonly roles: Repository<CustomRole>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  list(organizationId: string): Promise<CustomRole[]> {
    return this.roles.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async create(organizationId: string, dto: CreateCustomRoleDto): Promise<CustomRole> {
    const name = dto.name.trim();
    await this.assertNameFree(organizationId, name);
    const screens = sanitizeScreens(dto.screens);
    if (!hasRealScreen(screens)) throw new BadRequestException('Select at least one screen for this role.');
    return this.roles.save(
      this.roles.create({
        organizationId,
        name,
        description: dto.description,
        screens,
        isActive: true,
      }),
    );
  }

  async update(organizationId: string, id: string, dto: UpdateCustomRoleDto): Promise<CustomRole> {
    const role = await this.findOne(organizationId, id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertNameFree(organizationId, name, id);
      role.name = name;
    }
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.screens !== undefined) {
      const screens = sanitizeScreens(dto.screens);
      if (!hasRealScreen(screens)) throw new BadRequestException('Select at least one screen for this role.');
      role.screens = screens;
    }
    if (dto.isActive !== undefined) role.isActive = dto.isActive;
    return this.roles.save(role);
  }

  async remove(organizationId: string, id: string): Promise<{ deleted: true }> {
    await this.findOne(organizationId, id);
    const inUse = await this.users.count({ where: { organizationId, customRoleId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `This role is assigned to ${inUse} user(s). Reassign them before deleting it.`,
      );
    }
    await this.roles.delete({ id, organizationId });
    return { deleted: true };
  }

  findOne(organizationId: string, id: string): Promise<CustomRole> {
    return this.roles.findOne({ where: { id, organizationId } }).then((r) => {
      if (!r) throw new NotFoundException('Custom role not found');
      return r;
    });
  }

  /**
   * Resolve effective access for a user. Built-in roles keep their single role;
   * custom-role users get capabilities derived from their granted screens.
   */
  async resolveGrants(user: {
    role: Role;
    customRoleId: string | null;
    organizationId: string | null;
  }): Promise<ResolvedGrants> {
    if (user.customRoleId && user.organizationId) {
      const role = await this.roles.findOne({
        where: { id: user.customRoleId, organizationId: user.organizationId },
      });
      if (role && role.isActive) {
        const screens = sanitizeScreens(role.screens ?? []);
        return {
          grantedRoles: capabilitiesForScreens(screens),
          grantedScreens: screens,
          roleLabel: role.name,
          customRoleName: role.name,
        };
      }
      // Role was deleted or disabled — deny operational access until reassigned.
      return { grantedRoles: [], grantedScreens: [], roleLabel: 'No access', customRoleName: null };
    }
    return { grantedRoles: [user.role], roleLabel: ROLE_LABELS[user.role], customRoleName: null };
  }

  private async assertNameFree(organizationId: string, name: string, exceptId?: string): Promise<void> {
    const existing = await this.roles.findOne({ where: { organizationId, name } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('A role with this name already exists.');
    }
  }
}

/** True when at least one non-always screen is granted (dashboard alone doesn't count). */
function hasRealScreen(screens: string[]): boolean {
  return screens.some((p) => !ALWAYS_SCREEN_PATHS.includes(p));
}
