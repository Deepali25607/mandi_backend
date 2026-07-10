import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AllowWhenLocked } from '@/common/decorators/allow-when-locked.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { RequestSubscriptionPaymentDto } from './dto/subscription-payment.dto';

/**
 * Tenant-facing subscription screen: any org user can read status (for the
 * read-only banner); only the Org Admin can submit a manual payment. Reachable
 * even when the org is locked so a lapsed tenant can still subscribe.
 */
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionPaymentService) {}

  // Readable by any authenticated org user so the lock banner works for all roles.
  @Get('me')
  me(@CurrentUser('organizationId') organizationId: string | null) {
    if (!organizationId) throw new BadRequestException('No organization context');
    return this.service.getMine(organizationId);
  }

  @Roles(Role.ORG_ADMIN)
  @AllowWhenLocked()
  @Post('payments')
  request(
    @CurrentUser('organizationId') organizationId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: RequestSubscriptionPaymentDto,
  ) {
    if (!organizationId) throw new BadRequestException('No organization context');
    return this.service.request(organizationId, userId, dto);
  }
}
