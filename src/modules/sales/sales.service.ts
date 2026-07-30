import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { nextDocNumber } from '@/common/utils/doc-number.util';
import { Role } from '@/common/enums/role.enum';
import { LotStatus, PaymentMode } from '@/common/enums/domain.enum';
import { Item } from '@/modules/items/item.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
import { SupplierBill } from '@/modules/settlements/supplier-bill.entity';
import { Sale } from './sale.entity';
import { SaleLine } from './sale-line.entity';
import { CreateSaleDto, SaleLineDto, UpdateSaleDto } from './dto/sale.dto';

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
    this.assertSupplierRateAllowed(user, dto.lines);

    // Pre-load item defaults for commission / market fee fallbacks.
    const itemIds = [...new Set(dto.lines.map((l) => l.itemId))];
    const items = await this.items.find({ where: { organizationId } });
    const itemMap = new Map(items.map((i) => [i.id, i]));
    for (const id of itemIds) {
      if (!itemMap.has(id)) throw new BadRequestException(`Unknown item: ${id}`);
    }

    const saleId = await this.dataSource.transaction(async (manager) => {
      const saleNumber = await this.nextSaleNumber(manager, organizationId);
      const sale = await manager.save(
        manager.create(Sale, {
          organizationId,
          branchId,
          saleNumber,
          date: dto.date,
          customerId: dto.customerId,
          paymentMode: dto.paymentMode ?? PaymentMode.CREDIT,
          notes: dto.notes,
          otherCharges: dto.otherCharges ?? 0,
          otherChargesNote: dto.otherChargesNote,
          createdByUserId: user.id,
        }),
      );
      const totals = await this.applyLines(
        manager,
        { id: sale.id, organizationId, branchId },
        dto.lines,
        itemMap,
      );
      await manager.update(Sale, { id: sale.id }, totals);
      return sale.id;
    });

    // Re-read after commit so line relations are populated.
    return this.findOne(organizationId, saleId);
  }

  /**
   * Safe edit. Header fields (date/customer/payment/notes) are always editable.
   * Line items may only change while the sale is NOT part of a finalised supplier
   * settlement (a frozen bill snapshot would otherwise desync). Structural edits
   * atomically reverse the old stock drawdown and re-apply the new lines.
   */
  async update(user: AuthUser, id: string, dto: UpdateSaleDto): Promise<Sale> {
    const organizationId = user.organizationId!;
    this.assertSupplierRateAllowed(user, dto.lines ?? []);

    await this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id, organizationId },
        relations: { lines: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');

      // Scalar patch persisted with a plain UPDATE (never re-saving the loaded
      // entity, so the lines relation is not touched/cascaded).
      const patch: Partial<Sale> = {};
      if (dto.date !== undefined) patch.date = dto.date;
      if (dto.customerId !== undefined) patch.customerId = dto.customerId;
      if (dto.paymentMode !== undefined) patch.paymentMode = dto.paymentMode;
      if (dto.notes !== undefined) patch.notes = dto.notes;
      if (dto.otherCharges !== undefined) patch.otherCharges = dto.otherCharges;
      if (dto.otherChargesNote !== undefined) patch.otherChargesNote = dto.otherChargesNote;

      if (dto.lines !== undefined) {
        // Gate: any finalised supplier bill covering the involved suppliers +
        // this sale's date freezes the sale from structural edits.
        const settled = await this.isSettled(
          manager,
          organizationId,
          sale,
          dto.lines,
          dto.date ?? sale.date,
        );
        if (settled) {
          throw new ConflictException(
            'This sale is included in a finalised supplier settlement and cannot be edited. Reverse/redo the settlement first.',
          );
        }

        // Reverse the old drawdown, drop old lines, then re-apply the new ones.
        for (const old of sale.lines) {
          if (old.lotId) await this.restoreLot(manager, organizationId, old.lotId, old);
        }
        await manager.delete(SaleLine, { saleId: id });

        const items = await this.items.find({ where: { organizationId } });
        const itemMap = new Map(items.map((i) => [i.id, i]));
        for (const l of dto.lines) {
          if (!itemMap.has(l.itemId)) throw new BadRequestException(`Unknown item: ${l.itemId}`);
        }
        const totals = await this.applyLines(
          manager,
          { id, organizationId, branchId: sale.branchId },
          dto.lines,
          itemMap,
        );
        Object.assign(patch, totals);
      }

      if (Object.keys(patch).length > 0) {
        await manager.update(Sale, { id }, patch);
      }
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Delete a sale (Org Admin only — enforced at the controller). Reverses the
   * stock drawdown first, and refuses if the sale is in a finalised settlement.
   */
  async remove(organizationId: string, id: string): Promise<{ deleted: true }> {
    await this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id, organizationId },
        relations: { lines: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');

      const settled = await this.isSettled(manager, organizationId, sale, [], sale.date);
      if (settled) {
        throw new ConflictException(
          'This sale is included in a finalised supplier settlement and cannot be deleted. Reverse the settlement first.',
        );
      }

      for (const line of sale.lines) {
        if (line.lotId) await this.restoreLot(manager, organizationId, line.lotId, line);
      }
      await manager.delete(SaleLine, { saleId: id });
      await manager.delete(Sale, { id, organizationId });
    });
    return { deleted: true };
  }

  /** Sale detail plus whether its line items are locked (finalised settlement). */
  async findOneWithLock(organizationId: string, id: string) {
    const sale = await this.findOne(organizationId, id);
    const locked = await this.isSettled(
      this.dataSource.manager,
      organizationId,
      sale,
      [],
      sale.date,
    );
    return {
      ...sale,
      linesLocked: locked,
      lockReason: locked
        ? 'This sale is included in a finalised supplier settlement, so items cannot be changed. Header details can still be edited.'
        : null,
    };
  }

  /**
   * Builds sale lines (computing gross/commission/fee/net), draws down any
   * linked lots, and returns the rolled-up totals. Does NOT save the sale header
   * (the caller persists scalar fields via manager.update to avoid relation
   * cascades). Shared by create and (structural) update.
   */
  private async applyLines(
    manager: EntityManager,
    sale: { id: string; organizationId: string; branchId: string },
    linesDto: SaleLineDto[],
    itemMap: Map<string, Item>,
  ): Promise<{
    grossAmount: number;
    commissionAmount: number;
    marketFeeAmount: number;
    netAmount: number;
  }> {
    let grossTotal = 0;
    let commissionTotal = 0;
    let marketFeeTotal = 0;
    let netTotal = 0;
    const lines: SaleLine[] = [];

    for (const lineDto of linesDto) {
      const item = itemMap.get(lineDto.itemId)!;
      const commissionPct = lineDto.commissionPct ?? item.defaultCommissionPct ?? 0;
      const marketFeePct = lineDto.marketFeePct ?? item.defaultMarketFeePct ?? 0;

      // Rate applies to weight when present, else to quantity (per-unit sale).
      const base = lineDto.weight > 0 ? lineDto.weight : lineDto.quantity;
      const gross = round2(base * lineDto.rate);

      // Dual rate (Commission purchases): the customer is billed at `rate`,
      // but the supplier's side — gross, commission, fee, net — is computed
      // at `supplierRate`. Single-rate lines settle at the customer rate.
      if (lineDto.supplierRate != null) {
        await this.assertCommissionLot(manager, sale.organizationId, lineDto.lotId);
      }
      const supplierGross =
        lineDto.supplierRate != null ? round2(base * lineDto.supplierRate) : null;
      const settleBase = supplierGross ?? gross;
      const commissionAmount = round2((settleBase * commissionPct) / 100);
      const marketFeeAmount = round2((settleBase * marketFeePct) / 100);
      const netAmount = round2(settleBase - commissionAmount - marketFeeAmount);

      if (lineDto.lotId) {
        await this.drawDownLot(manager, sale.organizationId, sale.branchId, lineDto);
      }

      lines.push(
        manager.create(SaleLine, {
          saleId: sale.id,
          itemId: lineDto.itemId,
          lotId: lineDto.lotId ?? null,
          quantity: lineDto.quantity,
          weight: lineDto.weight,
          rate: lineDto.rate,
          supplierRate: lineDto.supplierRate ?? null,
          supplierGrossAmount: supplierGross,
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
    return {
      grossAmount: round2(grossTotal),
      commissionAmount: round2(commissionTotal),
      marketFeeAmount: round2(marketFeeTotal),
      netAmount: round2(netTotal),
    };
  }

  /** Supplier rate is confidential — only the Org Admin may set or change it. */
  private assertSupplierRateAllowed(user: AuthUser, lines: SaleLineDto[]): void {
    if (lines.some((l) => l.supplierRate != null) && user.role !== Role.ORG_ADMIN) {
      throw new ForbiddenException('Only the Org Admin can set the supplier rate.');
    }
  }

  /** Dual rate is only valid on lines drawn from a Commission-purchase lot. */
  private async assertCommissionLot(
    manager: EntityManager,
    organizationId: string,
    lotId?: string,
  ): Promise<void> {
    const fail = () => {
      throw new BadRequestException(
        'Supplier rate can only be set on items drawn from a Commission-purchase lot.',
      );
    };
    if (!lotId) fail();
    const lot = await manager.findOne(StockLot, { where: { id: lotId, organizationId } });
    if (!lot?.arrivalId) fail();
    const arrival = await manager.findOne(Arrival, {
      where: { id: lot!.arrivalId, organizationId },
      select: { id: true, purchaseType: true },
    });
    if (arrival?.purchaseType !== 'commission') fail();
  }

  /** Adds a reversed sale line's qty/weight back to its lot (reopens if closed). */
  private async restoreLot(
    manager: EntityManager,
    organizationId: string,
    lotId: string,
    line: { quantity: number; weight: number },
  ): Promise<void> {
    const lot = await manager.findOne(StockLot, { where: { id: lotId, organizationId } });
    if (!lot) return; // lot removed; nothing to restore
    lot.weightAvailable = round2(Math.min(lot.weightArrived, lot.weightAvailable + line.weight));
    lot.qtyAvailable = round2(Math.min(lot.qtyArrived, lot.qtyAvailable + line.quantity));
    if (lot.status === LotStatus.CLOSED && (lot.weightAvailable > 0.001 || lot.qtyAvailable > 0.001)) {
      lot.status = LotStatus.ACTIVE;
    }
    await manager.save(lot);
  }

  /**
   * True when a finalised supplier bill covers any supplier of the sale's lots
   * (old + proposed new) on the effective sale date — meaning the sale's figures
   * are already frozen into a settlement snapshot.
   */
  private async isSettled(
    manager: EntityManager,
    organizationId: string,
    sale: Sale,
    newLines: SaleLineDto[],
    effectiveDate: string,
  ): Promise<boolean> {
    const lotIds = [
      ...new Set(
        [
          ...sale.lines.map((l) => l.lotId),
          ...newLines.map((l) => l.lotId ?? null),
        ].filter((x): x is string => !!x),
      ),
    ];
    if (lotIds.length === 0) return false;

    const lots = await manager.find(StockLot, { where: { id: In(lotIds), organizationId } });
    const supplierIds = [...new Set(lots.map((l) => l.supplierId))];
    if (supplierIds.length === 0) return false;

    const bills = await manager.find(SupplierBill, {
      where: { organizationId, supplierId: In(supplierIds) },
    });
    const dates = [...new Set([sale.date, effectiveDate])];
    return bills.some((b) => dates.some((d) => b.fromDate <= d && d <= b.toDate));
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

  private nextSaleNumber(manager: EntityManager, organizationId: string): Promise<string> {
    return nextDocNumber(manager, 'sales', 'sale_number', 'SALE', organizationId);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
