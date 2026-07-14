import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccountsModule } from '@/modules/bank-accounts/bank-accounts.module';
import { CashTransfer } from './cash-transfer.entity';
import { CashTransfersService } from './cash-transfers.service';
import { CashTransfersController } from './cash-transfers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CashTransfer]), BankAccountsModule],
  providers: [CashTransfersService],
  controllers: [CashTransfersController],
  exports: [CashTransfersService],
})
export class CashTransfersModule {}
