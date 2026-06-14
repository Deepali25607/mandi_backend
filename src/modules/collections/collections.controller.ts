import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('branchId') branchId: string,
    @Query('customerId') customerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.collections.list(orgId, branchId, { customerId, from, to });
  }

  @Roles(Role.COLLECTION_EXECUTIVE, Role.ACCOUNTANT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCollectionDto) {
    return this.collections.create(user, dto);
  }
}
