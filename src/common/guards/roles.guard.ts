import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';

/**
 * Enforces @Roles(...) on routes.
 * - SUPER_ADMIN bypasses all role checks (platform-level access).
 * - ORG_ADMIN bypasses role checks for every ORG-level route — it can act as any
 *   operational role (Accountant, Sales, Inventory, Collection, Purchase, Auditor)
 *   so it can run any function in an emergency. It is still NOT granted
 *   SUPER_ADMIN-only (platform) routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('No authenticated user');
    if (user.role === Role.SUPER_ADMIN) return true;
    if (user.role === Role.ORG_ADMIN && !required.includes(Role.SUPER_ADMIN)) return true;

    // A user may hold several effective capability roles (custom roles bundle
    // the built-in capabilities derived from their granted screens).
    const granted = user.grantedRoles?.length ? user.grantedRoles : [user.role];
    if (!required.some((r) => granted.includes(r))) {
      throw new ForbiddenException('Insufficient role for this resource');
    }
    return true;
  }
}
