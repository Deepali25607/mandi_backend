import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '@/modules/items/item.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Sale } from './sale.entity';
import { SaleLine } from './sale-line.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleLine, StockLot, Item])],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
