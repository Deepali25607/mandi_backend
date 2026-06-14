import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Adjustment } from './adjustment.entity';
import { AdjustmentsService } from './adjustments.service';
import { AdjustmentsController } from './adjustments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Adjustment])],
  providers: [AdjustmentsService],
  controllers: [AdjustmentsController],
  exports: [AdjustmentsService],
})
export class AdjustmentsModule {}
