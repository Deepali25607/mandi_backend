import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { BackupService, BackupFile } from './backup.service';

/** Organization self-service data backup. Available to every org's admin, plan-independent. */
@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Roles(Role.ORG_ADMIN)
  @Get('export')
  export(@CurrentUser('organizationId') orgId: string) {
    return this.backup.export(orgId);
  }

  /**
   * Restore (reload) a previously-downloaded backup into the caller's own org.
   * Destructive: replaces current masters/transactions. Users & logins are kept.
   */
  @Roles(Role.ORG_ADMIN)
  @Post('restore')
  restore(@CurrentUser('organizationId') orgId: string, @Body() file: BackupFile) {
    return this.backup.restore(orgId, file);
  }
}
