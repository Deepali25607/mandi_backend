import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccountsModule } from '@/modules/bank-accounts/bank-accounts.module';
import { CashTransfersModule } from '@/modules/cash-transfers/cash-transfers.module';
import { CollectionsModule } from '@/modules/collections/collections.module';
import { Collection } from '@/modules/collections/collection.entity';
import { CustomersModule } from '@/modules/customers/customers.module';
import { ExpensesModule } from '@/modules/expenses/expenses.module';
import { Expense } from '@/modules/expenses/expense.entity';
import { OutstandingModule } from '@/modules/outstanding/outstanding.module';
import { Sale } from '@/modules/sales/sale.entity';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Collection, Expense]),
    CustomersModule,
    CollectionsModule,
    ExpensesModule,
    CashTransfersModule,
    BankAccountsModule,
    OutstandingModule,
  ],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
