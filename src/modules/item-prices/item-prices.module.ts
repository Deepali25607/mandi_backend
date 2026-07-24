import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsModule } from '@/modules/items/items.module';
import { User } from '@/modules/users/user.entity';
import { ItemPrice } from './item-price.entity';
import { ItemPricesController } from './item-prices.controller';
import { ItemPricesService } from './item-prices.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemPrice, User]), ItemsModule],
  controllers: [ItemPricesController],
  providers: [ItemPricesService],
  exports: [ItemPricesService],
})
export class ItemPricesModule {}
