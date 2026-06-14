import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { CrateTransaction } from './crate-transaction.entity';
import { CratesService } from './crates.service';
import { CratesController } from './crates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CrateTransaction, Customer, Supplier])],
  providers: [CratesService],
  controllers: [CratesController],
  exports: [CratesService],
})
export class CratesModule {}
