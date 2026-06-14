import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { UsersService } from '@/modules/users/users.service';
import { SubscriptionService } from '@/modules/platform/subscription.service';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  role: Role;
  organizationId: string | null;
  branchId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    private readonly subscriptions: SubscriptionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  /** Runs on every authenticated request; revalidates the user still exists & is active. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active');
    }
    const ctx = await this.subscriptions.resolveContext(user.organizationId);
    if (!ctx.organizationActive) {
      throw new UnauthorizedException('Organization is suspended. Contact platform support.');
    }
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      mobile: user.mobile,
      role: user.role,
      organizationId: user.organizationId,
      branchId: user.branchId,
      mustChangePassword: user.mustChangePassword,
      features: ctx.features,
      subscription: {
        planId: ctx.planId,
        planName: ctx.planName,
        status: ctx.status,
        renewalDate: ctx.renewalDate,
      },
    };
  }
}
