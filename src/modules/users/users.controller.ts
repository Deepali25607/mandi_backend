import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { UsersService } from './users.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

@Roles(Role.ORG_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser('organizationId') orgId: string) {
    return this.users.list(orgId);
  }

  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateUserDto) {
    return this.users.create(orgId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(orgId, id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(orgId, id, dto.newPassword);
  }
}
