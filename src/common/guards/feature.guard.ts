import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { FEATURE_KEY } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { Role } from '@/common/enums/role.enum';

/**
 * Enforces subscription feature flags. Runs after JwtAuthGuard + RolesGuard, so
 * `request.user.features` is already resolved from the org's plan.
 *
 * Handlers/controllers opt in with @RequireFeature(...). Anything without the
 * decorator is always allowed (core modules). Super Admin is exempt.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformFeature>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) return true; // public route — no subscription context
    if (user.role === Role.SUPER_ADMIN) return true;

    if (!user.features?.includes(required)) {
      throw new ForbiddenException('Your current subscription plan does not include this feature.');
    }
    return true;
  }
}
