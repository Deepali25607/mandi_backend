import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { LotStatus } from '@/common/enums/domain.enum';
import { Item } from '@/modules/items/item.entity';
import { StockLot } from './stock-lot.entity';

export interface StockSummaryRow {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  lots: number;
  qtyAvailable: number;
  weightAvailable: number;
  stockValue: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StockLot) private readonly lots: Repository<StockLot>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
  ) {}

  /** List lots for a branch, optionally only those with weight remaining. */
  listLots(
    organizationId: string,
    branchId: string,
    opts: { itemId?: string; availableOnly?: boolean } = {},
  ): Promise<StockLot[]> {
    const where: Record<string, unknown> = { organizationId, branchId };
    if (opts.itemId) where.itemId = opts.itemId;
    if (opts.availableOnly) where.weightAvailable = MoreThan(0);
    return this.lots.find({ where, order: { date: 'DESC', lotNumber: 'DESC' } });
  }

  /** Aggregate available stock per item (BRD: item-wise / lot-wise stock). */
  async summary(organizationId: string, branchId: string): Promise<StockSummaryRow[]> {
    const lots = await this.lots.find({
      where: { organizationId, branchId, status: LotStatus.ACTIVE },
    });
    const items = await this.items.find({ where: { organizationId } });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const rows = new Map<string, StockSummaryRow>();
    for (const lot of lots) {
      const item = itemMap.get(lot.itemId);
      let row = rows.get(lot.itemId);
      if (!row) {
        row = {
          itemId: lot.itemId,
          itemName: item?.name ?? 'Unknown item',
          category: item?.category ?? '-',
          unit: item?.unit ?? 'kg',
          lots: 0,
          qtyAvailable: 0,
          weightAvailable: 0,
          stockValue: 0,
        };
        rows.set(lot.itemId, row);
      }
      row.lots += 1;
      row.qtyAvailable += lot.qtyAvailable;
      row.weightAvailable += lot.weightAvailable;
      row.stockValue += lot.weightAvailable * lot.rate;
    }
    return [...rows.values()].sort((a, b) => b.stockValue - a.stockValue);
  }
}
