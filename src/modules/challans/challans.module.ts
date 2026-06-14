import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Challan } from './challan.entity';
import { ChallanLine } from './challan-line.entity';
import { ChallansService } from './challans.service';
import { ChallansController } from './challans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Challan, ChallanLine, StockLot])],
  providers: [ChallansService],
  controllers: [ChallansController],
  exports: [ChallansService],
})
export class ChallansModule {}
