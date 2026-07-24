import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { LotStatus } from '@/common/enums/domain.enum';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Arrival } from './arrival.entity';
import { ArrivalLine } from './arrival-line.entity';
import { CreateArrivalDto, PurchaseType, UpdateArrivalDto } from './dto/arrival.dto';

/** Bilty = outright purchase: every line must carry a real rate. */
function assertRatesForType(
  purchaseType: PurchaseType,
  lines: { rate?: number }[],
): void {
  if (purchaseType === 'bilty' && lines.some((l) => !(Number(l.rate) > 0))) {
    throw new BadRequestException(
      'Rate is required for every item on a Bilty purchase. Enter a rate, or switch the purchase type to Commission.',
    );
  }
}

/** A lot is "used" once anything (a sale/challan) has drawn it down. */
function lotIsUsed(l: StockLot): boolean {
  return (
    l.status !== LotStatus.ACTIVE ||
    l.weightAvailable < l.weightArrived - 0.001 ||
    l.qtyAvailable < l.qtyArrived - 0.001
  );
}

@Injectable()
export class ArrivalsService {
  constructor(
    @InjectRepository(Arrival) private readonly arrivals: Repository<Arrival>,
    private readonly dataSource: DataSource,
  ) {}

  list(organizationId: string, branchId: string): Promise<Arrival[]> {
    return this.arrivals.find({
      where: { organizationId, branchId },
      relations: { lines: true },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(organizationId: string, id: string): Promise<Arrival> {
    const arrival = await this.arrivals.findOne({
      where: { id, organizationId },
      relations: { lines: true },
    });
    if (!arrival) throw new NotFoundException('Arrival not found');
    return arrival;
  }

  /**
   * Delete an arrival (Org Admin only — enforced at the controller). Removes the
   * spawned stock lots + lines, and refuses if any of the lots have been used
   * (sold/transferred).
   */
  async remove(organizationId: string, id: string): Promise<{ deleted: true }> {
    await this.dataSource.transaction(async (manager) => {
      const arrival = await manager.findOne(Arrival, { where: { id, organizationId } });
      if (!arrival) throw new NotFoundException('Arrival not found');

      const lots = await manager.find(StockLot, { where: { arrivalId: id, organizationId } });
      if (lots.some(lotIsUsed)) {
        throw new ConflictException(
          'This arrival cannot be deleted: stock from it has already been sold or transferred. Reverse those entries first.',
        );
      }

      await manager.delete(StockLot, { arrivalId: id, organizationId });
      await manager.delete(ArrivalLine, { arrivalId: id });
      await manager.delete(Arrival, { id, organizationId });
    });
    return { deleted: true };
  }

  /** Arrival detail plus whether its line items are locked from editing. */
  async findOneWithLock(organizationId: string, id: string) {
    const arrival = await this.findOne(organizationId, id);
    const lots = await this.dataSource
      .getRepository(StockLot)
      .find({ where: { arrivalId: id, organizationId } });
    const locked = lots.some(lotIsUsed);
    return {
      ...arrival,
      linesLocked: locked,
      lockReason: locked
        ? 'Stock from this arrival has already been sold or transferred, so items and supplier cannot be changed. Header details can still be edited.'
        : null,
    };
  }

  /**
   * Creates an arrival + its lines, and spawns one stock lot per line.
   * All in a single transaction so stock and the arrival stay consistent.
   */
  async create(user: AuthUser, dto: CreateArrivalDto): Promise<Arrival> {
    const organizationId = user.organizationId!;
    const branchId = user.branchId!;
    const purchaseType = dto.purchaseType ?? 'bilty';
    assertRatesForType(purchaseType, dto.lines);

    const arrivalId = await this.dataSource.transaction(async (manager) => {
      const arrivalNumber = await this.nextArrivalNumber(manager, organizationId);
      const arrival = await manager.save(
        manager.create(Arrival, {
          organizationId,
          branchId,
          arrivalNumber,
          date: dto.date,
          supplierId: dto.supplierId,
          purchaseType,
          vehicleNumber: dto.vehicleNumber,
          transportCharges: dto.transportCharges ?? 0,
          notes: dto.notes,
          createdByUserId: user.id,
        }),
      );
      const totals = await this.spawnLinesAndLots(
        manager,
        { id: arrival.id, organizationId, branchId },
        dto.supplierId,
        dto.date,
        dto.lines,
      );
      await manager.update(Arrival, { id: arrival.id }, totals);
      return arrival.id;
    });

    // Re-read after commit so relations are populated from a fresh query.
    return this.findOne(organizationId, arrivalId);
  }

  /**
   * Safe edit. Header fields (date/vehicle/transport/notes) are always editable.
   * Supplier + line items may only change while every lot from this arrival is
   * still untouched (nothing sold/transferred); otherwise a 409 is thrown and
   * only the header is updated.
   */
  async update(user: AuthUser, id: string, dto: UpdateArrivalDto): Promise<Arrival> {
    const organizationId = user.organizationId!;

    await this.dataSource.transaction(async (manager) => {
      const arrival = await manager.findOne(Arrival, {
        where: { id, organizationId },
        relations: { lines: true },
      });
      if (!arrival) throw new NotFoundException('Arrival not found');

      const lots = await manager.find(StockLot, { where: { arrivalId: id, organizationId } });
      const used = lots.some(lotIsUsed);

      const wantsStructural =
        dto.lines !== undefined ||
        (dto.supplierId !== undefined && dto.supplierId !== arrival.supplierId);
      if (wantsStructural && used) {
        throw new ConflictException(
          'This arrival cannot be edited: stock from it has already been sold or transferred. Reverse those entries first.',
        );
      }

      // Rate rules follow the purchase type the arrival will END UP with —
      // switching to Bilty is refused while any line lacks a rate.
      const effectiveType = dto.purchaseType ?? arrival.purchaseType;
      if (dto.purchaseType !== undefined || dto.lines !== undefined) {
        assertRatesForType(effectiveType, dto.lines ?? arrival.lines);
      }

      // Scalar patch persisted with a plain UPDATE (never re-saving the loaded
      // entity, so the lines relation is not touched/cascaded).
      const patch: Partial<Arrival> = {};
      if (dto.purchaseType !== undefined) patch.purchaseType = dto.purchaseType;
      if (dto.date !== undefined) patch.date = dto.date;
      if (dto.vehicleNumber !== undefined) patch.vehicleNumber = dto.vehicleNumber;
      if (dto.transportCharges !== undefined) patch.transportCharges = dto.transportCharges;
      if (dto.notes !== undefined) patch.notes = dto.notes;

      if (wantsStructural) {
        // Untouched → safe to rebuild lines + lots from scratch.
        const supplierId = dto.supplierId ?? arrival.supplierId;
        const date = patch.date ?? arrival.date;
        const linesInput = (dto.lines ?? arrival.lines).map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          weight: l.weight,
          rate: l.rate ?? 0,
        }));
        await manager.delete(ArrivalLine, { arrivalId: id });
        await manager.delete(StockLot, { arrivalId: id });
        const totals = await this.spawnLinesAndLots(
          manager,
          { id, organizationId, branchId: arrival.branchId },
          supplierId,
          date,
          linesInput,
        );
        patch.supplierId = supplierId;
        Object.assign(patch, totals);
      } else if (dto.date !== undefined) {
        // Header-only: keep lots in sync with a date change.
        await manager.update(StockLot, { arrivalId: id, organizationId }, { date: patch.date });
      }

      if (Object.keys(patch).length > 0) {
        await manager.update(Arrival, { id }, patch);
      }
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Builds arrival lines and one stock lot per line for the given arrival, and
   * returns the rolled-up totals. Does NOT save the arrival header (the caller
   * persists scalar fields via manager.update to avoid relation cascades).
   * Shared by create and (structural) update.
   */
  private async spawnLinesAndLots(
    manager: EntityManager,
    arrival: { id: string; organizationId: string; branchId: string },
    supplierId: string,
    date: string,
    linesInput: { itemId: string; quantity: number; weight: number; rate?: number }[],
  ): Promise<{ totalQuantity: number; totalWeight: number; totalValue: number }> {
    const organizationId = arrival.organizationId;
    // Lot number = <SUPP4>-<qty>-<seq 0001..>: first 4 letters of the supplier
    // name, the bags entered, and an org-wide running number (max+1, never
    // reused, unbounded past 9999) so every lot stays unique.
    let seqBase = await this.maxLotSeq(manager, organizationId);

    // Prefix each lot with the supplier's first 4 letters.
    const supplier = await manager.findOne(Supplier, {
      where: { id: supplierId, organizationId },
      select: { id: true, name: true },
    });
    const prefix = namePrefix(supplier?.name ?? '');

    let totalQuantity = 0;
    let totalWeight = 0;
    let totalValue = 0;
    const lines: ArrivalLine[] = [];

    for (const lineDto of linesInput) {
      seqBase += 1;
      const seq = String(seqBase).padStart(4, '0');
      const lotNumber = `${prefix}-${fmtNum(lineDto.quantity)}-${seq}`;
      const rate = lineDto.rate ?? 0;
      const amount = round2(lineDto.weight * rate);

      lines.push(
        manager.create(ArrivalLine, {
          arrivalId: arrival.id,
          itemId: lineDto.itemId,
          lotNumber,
          quantity: lineDto.quantity,
          weight: lineDto.weight,
          rate,
          amount,
        }),
      );

      await manager.save(
        manager.create(StockLot, {
          organizationId,
          branchId: arrival.branchId,
          lotNumber,
          itemId: lineDto.itemId,
          supplierId,
          arrivalId: arrival.id,
          rate,
          qtyArrived: lineDto.quantity,
          weightArrived: lineDto.weight,
          qtyAvailable: lineDto.quantity,
          weightAvailable: lineDto.weight,
          status: LotStatus.ACTIVE,
          date,
        }),
      );

      totalQuantity += lineDto.quantity;
      totalWeight += lineDto.weight;
      totalValue += amount;
    }

    await manager.save(lines);
    return {
      totalQuantity: round2(totalQuantity),
      totalWeight: round2(totalWeight),
      totalValue: round2(totalValue),
    };
  }

  /** Highest trailing "-NNN" sequence across the org's lot numbers (0 if none). */
  private async maxLotSeq(manager: EntityManager, organizationId: string): Promise<number> {
    const lots = await manager.find(StockLot, {
      where: { organizationId },
      select: { id: true, lotNumber: true },
    });
    let max = 0;
    for (const l of lots) {
      const m = l.lotNumber.match(/-(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max;
  }

  private async nextArrivalNumber(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const count = await manager.count(Arrival, { where: { organizationId } });
    return `ARR-${String(count + 1).padStart(4, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compact number for lot labels: 100, 6120, or 6120.5 (no trailing zeros). */
function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** First 4 alphanumerics of a name, upper-cased and padded, for lot codes. */
function namePrefix(name: string): string {
  const clean = (name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (clean + 'XXXX').slice(0, 4);
}
