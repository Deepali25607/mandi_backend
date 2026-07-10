import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { ALLOW_WHEN_LOCKED_KEY } from '@/common/decorators/allow-when-locked.decorator';
import { Role } from '@/common/enums/role.enum';

/**
 * Enforces a read-only lock once an organization's trial/subscription has
 * lapsed. Runs after JwtAuthGuard + RolesGuard, so `request.user.subscription`
 * (incl. the computed `locked` flag) is already resolved.
 *
 * When locked: reads (GET/HEAD/OPTIONS) are allowed so tenants can still view
 * their data; writes are blocked with 402 Payment Required — EXCEPT routes
 * explicitly marked @AllowWhenLocked (e.g. submitting a payment). Super Admin
 * and public routes are exempt.
 */
@Injectable()
export class SubscriptionLockGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) return true; // public route — no subscription context
    if (user.role === Role.SUPER_ADMIN) return true;
    if (!user.subscription?.locked) return true;

    // Locked → read-only. Allow safe reads through.
    const method = String(request.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

    // Allow explicitly whitelisted writes (paying, password change, etc.).
    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_LOCKED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allow) return true;

    throw new HttpException(
      'Your free trial or subscription has ended. Your account is read-only until a payment is confirmed. Please subscribe to continue.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
