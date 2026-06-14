import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { LotStatus, PaymentMode } from '@/common/enums/domain.enum';
import { Item } from '@/modules/items/item.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Sale } from './sale.entity';
import { SaleLine } from './sale-line.entity';
import { CreateSaleDto, SaleLineDto } from './dto/sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    private readonly dataSource: DataSource,
  ) {}

  list(organizationId: string, branchId: string): Promise<Sale[]> {
    return this.sales.find({
      where: { organizationId, branchId },
      relations: { lines: true },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(organizationId: string, id: string): Promise<Sale> {
    const sale = await this.sales.findOne({
      where: { id, organizationId },
      relations: { lines: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  /**
   * Records a single-window sale (BRD Module 4). Computes per-line gross,
   * commission, market fee and net, draws down the chosen stock lots, and
   * persists everything atomically.
   *
   * Money model (adhati): customer is billed `gross`; supplier nets
   * `gross − commission − market fee`. The agent earns the commission.
   */
  async create(user: AuthUser, dto: CreateSaleDto): Promise<Sale> {
    const organizationId = user.organizationId!;
    const branchId = user.branchId!;

    // Pre-load item defaults for commission / market fee fallbacks.
    const itemIds = [...new Set(dto.lines.map((l) => l.itemId))];
    const items = await this.items.find({ where: { organizationId } });
    const itemMap = new Map(items.map((i) => [i.id, i]));
    for (const id of itemIds) {
      if (!itemMap.has(id)) throw new BadRequestException(`Unknown item: ${id}`);
    }

    const saleId = await this.dataSource.transaction(async (manager) => {
      const saleNumber = await this.nextSaleNumber(manager, organizationId);

      const sale = manager.create(Sale, {
        organizationId,
        branchId,
        saleNumber,
        date: dto.date,
        customerId: dto.customerId,
        paymentMode: dto.paymentMode ?? PaymentMode.CREDIT,
        notes: dto.notes,
        createdByUserId: user.id,
      });
      const savedSale = await manager.save(sale);

      let grossTotal = 0;
      let commissionTotal = 0;
      let marketFeeTotal = 0;
      let netTotal = 0;

      const lines: SaleLine[] = [];
      for (const lineDto of dto.lines) {
        const item = itemMap.get(lineDto.itemId)!;
        const commissionPct = lineDto.commissionPct ?? item.defaultCommissionPct ?? 0;
        const marketFeePct = lineDto.marketFeePct ?? item.defaultMarketFeePct ?? 0;

        // Rate applies to weight when present, else to quantity (per-unit sale).
        const base = lineDto.weight > 0 ? lineDto.weight : lineDto.quantity;
        const gross = round2(base * lineDto.rate);
        const commissionAmount = round2((gross * commissionPct) / 100);
        const marketFeeAmount = round2((gross * marketFeePct) / 100);
        const netAmount = round2(gross - commissionAmount - marketFeeAmount);

        if (lineDto.lotId) {
          await this.drawDownLot(manager, organizationId, branchId, lineDto);
        }

        lines.push(
          manager.create(SaleLine, {
            saleId: savedSale.id,
            itemId: lineDto.itemId,
            lotId: lineDto.lotId ?? null,
            quantity: lineDto.quantity,
            weight: lineDto.weight,
            rate: lineDto.rate,
            commissionPct,
            marketFeePct,
            grossAmount: gross,
            commissionAmount,
            marketFeeAmount,
            netAmount,
          }),
        );

        grossTotal += gross;
        commissionTotal += commissionAmount;
        marketFeeTotal += marketFeeAmount;
        netTotal += netAmount;
      }

      await manager.save(lines);
      savedSale.grossAmount = round2(grossTotal);
      savedSale.commissionAmount = round2(commissionTotal);
      savedSale.marketFeeAmount = round2(marketFeeTotal);
      savedSale.netAmount = round2(netTotal);
      await manager.save(savedSale);

      return savedSale.id;
    });

    // Re-read after commit so line relations are populated.
    return this.findOne(organizationId, saleId);
  }

  private async drawDownLot(
    manager: EntityManager,
    organizationId: string,
    branchId: string,
    line: SaleLineDto,
  ): Promise<void> {
    const lot = await manager.findOne(StockLot, {
      where: { id: line.lotId, organizationId, branchId },
    });
    if (!lot) throw new BadRequestException('Stock lot not found for this branch');

    if (line.weight > lot.weightAvailable + 0.001) {
      throw new BadRequestException(
        `Lot ${lot.lotNumber}: only ${lot.weightAvailable} available, ${line.weight} requested`,
      );
    }

    lot.weightAvailable = round2(lot.weightAvailable - line.weight);
    lot.qtyAvailable = round2(Math.max(0, lot.qtyAvailable - line.quantity));
    if (lot.weightAvailable <= 0.001 && lot.qtyAvailable <= 0.001) {
      lot.status = LotStatus.CLOSED;
      lot.weightAvailable = 0;
      lot.qtyAvailable = 0;
    }
    await manager.save(lot);
  }

  private async nextSaleNumber(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const count = await manager.count(Sale, { where: { organizationId } });
    return `SALE-${String(count + 1).padStart(4, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
