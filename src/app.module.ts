import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { buildDatabaseConfig } from './config/database.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsersModule } from './modules/users/users.module';
import { ItemsModule } from './modules/items/items.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ArrivalsModule } from './modules/arrivals/arrivals.module';
import { SalesModule } from './modules/sales/sales.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { OutstandingModule } from './modules/outstanding/outstanding.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AdjustmentsModule } from './modules/adjustments/adjustments.module';
import { ChallansModule } from './modules/challans/challans.module';
import { CratesModule } from './modules/crates/crates.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { BranchesModule } from './modules/branches/branches.module';
import { PlatformModule } from './modules/platform/platform.module';
import { BackupModule } from './modules/backup/backup.module';
import { FeatureGuard } from './common/guards/feature.guard';
import { Organization } from './modules/organizations/organization.entity';
import { Branch } from './modules/branches/branch.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildDatabaseConfig,
    }),
    // Register Organization/Branch so their tables are created via autoLoadEntities.
    TypeOrmModule.forFeature([Organization, Branch]),
    UsersModule,
    AuthModule,
    DashboardModule,
    ItemsModule,
    SuppliersModule,
    CustomersModule,
    InventoryModule,
    ArrivalsModule,
    SalesModule,
    CollectionsModule,
    ExpensesModule,
    SettlementsModule,
    OutstandingModule,
    AccountingModule,
    AdjustmentsModule,
    ChallansModule,
    CratesModule,
    OrganizationsModule,
    BranchesModule,
    PlatformModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    // JWT auth runs first (global), then role checks, then subscription feature checks.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
