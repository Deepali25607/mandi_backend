import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { ItemsService } from './items.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  // Reads are open to any authenticated tenant user (needed for sale/arrival entry).
  @Get()
  findAll(@CurrentUser('organizationId') orgId: string, @Query('search') search?: string) {
    return this.items.findAll(orgId, search);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.items.findOne(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.INVENTORY_MANAGER)
  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateItemDto) {
    return this.items.create(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.INVENTORY_MANAGER)
  @Patch(':id')
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.items.update(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.INVENTORY_MANAGER)
  @Delete(':id')
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.items.remove(orgId, id);
  }
}
