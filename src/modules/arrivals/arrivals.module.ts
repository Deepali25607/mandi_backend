import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Arrival } from './arrival.entity';
import { ArrivalLine } from './arrival-line.entity';
import { ArrivalsService } from './arrivals.service';
import { ArrivalsController } from './arrivals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Arrival, ArrivalLine, StockLot])],
  providers: [ArrivalsService],
  controllers: [ArrivalsController],
  exports: [ArrivalsService],
})
export class ArrivalsModule {}
