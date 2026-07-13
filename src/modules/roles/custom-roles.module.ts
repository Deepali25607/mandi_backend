import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/users/user.entity';
import { CustomRole } from './custom-role.entity';
import { CustomRolesService } from './custom-roles.service';
import { CustomRolesController } from './custom-roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomRole, User])],
  providers: [CustomRolesService],
  controllers: [CustomRolesController],
  exports: [CustomRolesService],
})
export class CustomRolesModule {}
