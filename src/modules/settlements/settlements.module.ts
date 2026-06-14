import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { SupplierBill } from './supplier-bill.entity';
import { SupplierPayment } from './supplier-payment.entity';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierBill, SupplierPayment, SaleLine])],
  providers: [SettlementsService],
  controllers: [SettlementsController],
  exports: [SettlementsService],
})
export class SettlementsModule {}
