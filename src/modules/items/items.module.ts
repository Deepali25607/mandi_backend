import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Adjustment } from '@/modules/adjustments/adjustment.entity';
import { ArrivalLine } from '@/modules/arrivals/arrival-line.entity';
import { ChallanLine } from '@/modules/challans/challan-line.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Item } from './item.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  // Reference entities are needed so hard delete can check the item is unused.
  imports: [TypeOrmModule.forFeature([Item, StockLot, ArrivalLine, SaleLine, ChallanLine, Adjustment])],
  providers: [ItemsService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
