import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { Item } from '@/modules/items/item.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Customer } from '@/modules/customers/customer.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
import { ArrivalLine } from '@/modules/arrivals/arrival-line.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Collection } from '@/modules/collections/collection.entity';
import { SupplierBill } from '@/modules/settlements/supplier-bill.entity';
import { SupplierPayment } from '@/modules/settlements/supplier-payment.entity';
import { Expense } from '@/modules/expenses/expense.entity';
import { CrateTransaction } from '@/modules/crates/crate-transaction.entity';
import { Adjustment } from '@/modules/adjustments/adjustment.entity';
import { Challan } from '@/modules/challans/challan.entity';
import { ChallanLine } from '@/modules/challans/challan-line.entity';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization, Branch, User, Item, Supplier, Customer, StockLot,
      Arrival, ArrivalLine, Sale, SaleLine, Collection, SupplierBill,
      SupplierPayment, Expense, CrateTransaction, Adjustment, Challan, ChallanLine,
    ]),
  ],
  providers: [BackupService],
  controllers: [BackupController],
})
export class BackupModule {}
