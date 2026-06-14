import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '@/modules/items/item.entity';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
import { Collection } from '@/modules/collections/collection.entity';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { OutstandingModule } from '@/modules/outstanding/outstanding.module';
import { SettlementsModule } from '@/modules/settlements/settlements.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, Customer, Supplier, Sale, SaleLine, Arrival, Collection]),
    InventoryModule,
    OutstandingModule,
    SettlementsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
