import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { PrinterProfilesService } from './printer-profiles.service';
import { CreatePrinterProfileDto, UpdatePrinterProfileDto } from './dto/printer-profile.dto';

@Controller('printer-profiles')
export class PrinterProfilesController {
  constructor(private readonly printers: PrinterProfilesService) {}

  // Any signed-in tenant user can read them — the print menu needs the list.
  @Get()
  list(@CurrentUser('organizationId') orgId: string) {
    return this.printers.list(orgId);
  }

  @Roles(Role.ORG_ADMIN)
  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreatePrinterProfileDto) {
    return this.printers.create(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePrinterProfileDto,
  ) {
    return this.printers.update(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.printers.remove(orgId, id);
  }
}
