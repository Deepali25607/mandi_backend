import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@/common/enums/role.enum';
import { PlatformFeature, SubscriptionStatus } from '@/common/enums/feature.enum';

/** Shape of the authenticated principal attached to the request by JwtStrategy. */
export interface AuthUser {
  id: string;
  name: string;
  username: string;
  mobile?: string;
  role: Role;
  organizationId: string | null;
  branchId: string | null;
  mustChangePassword: boolean;
  /** Feature keys enabled by the org's subscription plan (empty for Super Admin). */
  features?: PlatformFeature[];
  /** Org subscription summary, resolved per request. */
  subscription?: {
    planId: string | null;
    planName: string | null;
    status: SubscriptionStatus | null;
    renewalDate: string | null;
  };
}

/** Injects the authenticated user (or a single property of it) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    return data ? user?.[data] : user;
  },
);
