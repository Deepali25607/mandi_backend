import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLE_LABELS, Role } from '@/common/enums/role.enum';
import {
  hashSecret,
  normalizeAnswer,
  normalizeUsername,
  verifySecret,
} from '@/common/utils/password.util';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { PlansService } from '@/modules/platform/plans.service';
import { SubscriptionService } from '@/modules/platform/subscription.service';
import { SubscriptionStatus } from '@/common/enums/feature.enum';
import { JwtPayload } from './strategies/jwt.strategy';
import {
  ChangePasswordDto,
  LoginDto,
  RecoverDto,
  RegisterOrganizationDto,
  SecurityQuestionDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly jwt: JwtService,
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /** Username + password login. */
  async login(dto: LoginDto) {
    const username = normalizeUsername(dto.username);
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.username = :username', { username })
      .getOne();

    if (!user || !user.passwordHash || !(await verifySecret(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const ctx = await this.subscriptions.resolveContext(user.organizationId);
    if (!ctx.organizationActive) {
      throw new UnauthorizedException('Your organization is suspended. Please contact platform support.');
    }

    return this.issueToken(user);
  }

  /** Self-service organization onboarding: creates org + main branch + admin user. */
  async registerOrganization(dto: RegisterOrganizationDto) {
    const username = normalizeUsername(dto.username);
    const existing = await this.users.findOne({ where: { username } });
    if (existing) throw new ConflictException('Username already taken');

    // Assign the chosen public plan, or fall back to the platform default.
    let plan = dto.planId ? await this.plans.findOne(dto.planId).catch(() => null) : null;
    if (!plan) plan = await this.plans.findDefault();

    const today = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + 14);
    const toDate = (d: Date) => d.toISOString().slice(0, 10);

    const org = await this.orgs.save(
      this.orgs.create({
        name: dto.organizationName,
        mobile: dto.mobile,
        email: dto.email,
        planId: plan?.id ?? null,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        subscriptionStart: toDate(today),
        renewalDate: toDate(trialEnd),
      }),
    );
    const branch = await this.branches.save(
      this.branches.create({ organizationId: org.id, name: 'Main Branch' }),
    );
    const passwordHash = await hashSecret(dto.password);
    const user = await this.users.save(
      this.users.create({
        organizationId: org.id,
        branchId: branch.id,
        name: dto.adminName,
        username,
        mobile: dto.mobile,
        email: dto.email,
        role: Role.ORG_ADMIN,
        passwordHash,
        mustChangePassword: false,
        isActive: true,
      }),
    );
    return this.issueToken(user);
  }

  /** Change own password (also clears the must-change flag). */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :userId', { userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');
    if (!(await verifySecret(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await hashSecret(dto.newPassword);
    user.mustChangePassword = false;
    await this.users.save(user);
    return { message: 'Password changed successfully' };
  }

  /** Set/update own security question for self-service recovery. */
  async setSecurityQuestion(userId: string, dto: SecurityQuestionDto) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.securityQuestion = dto.question;
    user.securityAnswerHash = await hashSecret(normalizeAnswer(dto.answer));
    await this.users.save(user);
    return { message: 'Security question saved' };
  }

  /** Step 1 of recovery: fetch the user's security question. */
  async getRecoveryQuestion(username: string) {
    const user = await this.users.findOne({ where: { username: normalizeUsername(username) } });
    if (!user || !user.securityQuestion) {
      throw new NotFoundException('No recovery question is set for this account. Ask your admin to reset your password.');
    }
    return { username: user.username, question: user.securityQuestion };
  }

  /** Step 2 of recovery: verify answer and set a new password. */
  async recover(dto: RecoverDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.securityAnswerHash')
      .where('u.username = :username', { username: normalizeUsername(dto.username) })
      .getOne();
    if (!user || !user.securityAnswerHash) {
      throw new BadRequestException('Recovery is not available for this account');
    }
    if (!(await verifySecret(normalizeAnswer(dto.answer), user.securityAnswerHash))) {
      throw new BadRequestException('Incorrect answer to the security question');
    }
    user.passwordHash = await hashSecret(dto.newPassword);
    user.mustChangePassword = false;
    await this.users.save(user);
    return { message: 'Password reset successfully. You can now log in.' };
  }

  private async issueToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
      branchId: user.branchId,
    };
    const ctx = await this.subscriptions.resolveContext(user.organizationId);
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        mobile: user.mobile,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role],
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
      },
    };
  }
}
