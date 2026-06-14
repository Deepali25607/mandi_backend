import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { CollectionsModule } from '@/modules/collections/collections.module';
import { SettlementsModule } from '@/modules/settlements/settlements.module';
import { AdjustmentsModule } from '@/modules/adjustments/adjustments.module';
import { OutstandingService } from './outstanding.service';
import { OutstandingController } from './outstanding.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Supplier, Sale]),
    CollectionsModule,
    SettlementsModule,
    AdjustmentsModule,
  ],
  providers: [OutstandingService],
  controllers: [OutstandingController],
  exports: [OutstandingService],
})
export class OutstandingModule {}
