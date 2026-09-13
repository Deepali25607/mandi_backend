import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { nextDocNumber } from '@/common/utils/doc-number.util';
import { PaymentMode } from '@/common/enums/domain.enum';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { SupplierBill, SupplierBillStatus } from './supplier-bill.entity';
import { SupplierPayment } from './supplier-payment.entity';

export interface SupplierSalesAgg {
  gross: number;
  commission: number;
  marketFee: number;
  net: number;
  saleLineCount: number;
}

/** Sold quantities per lot — shows exactly which lots a settlement covers. */
export interface LotBreakdownRow {
  lotId: string;
  lotNumber: string;
  itemId: string;
  qty: number;
  weight: number;
  gross: number;
  net: number;
  lines: number;
}

/**
 * How much of one arrival's transport (bhada) this settlement carries.
 * Freight is paid per arrival; an item/lot-wise bill takes the weight share of
 * the lines it settles (a single-lot arrival → the whole amount).
 */
export interface TransportShare {
  arrivalId: string;
  arrivalNumber: string;
  arrivalDate: string;
  /** Freight recorded on the arrival entry. */
  arrivalTransport: number;
  /** Weight of the settled lines vs the arrival's total weight. */
  shareWeight: number;
  arrivalWeight: number;
  /** arrivalTransport × shareWeight / arrivalWeight (2 dp). */
  amount: number;
}

/** Sales aggregate plus transport + the lot-wise detail for a settlement preview. */
export interface SupplierBillPreview extends SupplierSalesAgg {
  transport: number;
  transportDetail: TransportShare[];
  /** Bills that already cover the requested scope (filled when nothing is left to settle). */
  settledBy: string[];
  lots: LotBreakdownRow[];
  /** Advances paid against the lots being settled, oldest first — adjusted on the bill. */
  advances: AdvanceRow[];
  advanceTotal: number;
}

interface CreateBillInput {
  supplierId: string;
  itemId?: string;
  lotId?: string;
  fromDate: string;
  toDate: string;
  date: string;
  labourCharges?: number;
  crateCharges?: number;
  otherCharges?: number;
  notes?: string;
}

interface CreatePaymentInput {
  supplierId: string;
  date: string;
  amount: number;
  paymentMode?: PaymentMode;
  billId?: string;
  /** Advance against a specific lot. */
  lotId?: string;
  reference?: string;
  notes?: string;
}

/** One advance payment that a settlement adjusts. */
export interface AdvanceRow {
  paymentId: string;
  paymentNumber: string;
  date: string;
  amount: number;
  paymentMode: PaymentMode;
  lotId: string;
  lotNumber: string;
  reference?: string;
}

@Injectable()
export class SettlementsService implements OnModuleInit {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    @InjectRepository(SupplierBill) private readonly bills: Repository<SupplierBill>,
    @InjectRepository(SupplierPayment) private readonly payments: Repository<SupplierPayment>,
    @InjectRepository(SaleLine) private readonly saleLines: Repository<SaleLine>,
    @InjectRepository(Arrival) private readonly arrivals: Repository<Arrival>,
    @InjectRepository(StockLot) private readonly stockLots: Repository<StockLot>,
  ) {}

  /**
   * One-time, idempotent backfill for bills generated before sale lines were
   * stamped: attribute their lines (and the lots' freight) now, oldest bill
   * first, so those sales can never be settled a second time. Only touches
   * rows that are still unstamped, so re-running is harmless.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.backfillSettledLines();
    } catch (e) {
      this.logger.error(`Settlement backfill failed: ${(e as Error).message}`);
    }
  }

  private async backfillSettledLines(): Promise<void> {
    const bills = await this.bills.find({ order: { createdAt: 'ASC' } });
    let stamped = 0;
    for (const b of bills) {
      const qb = this.saleLines.createQueryBuilder().update(SaleLine).set({ supplierBillId: b.id })
        .where('supplier_bill_id IS NULL')
        .andWhere('sale_id IN (SELECT s.id FROM sales s WHERE s.organization_id = :org AND s.date BETWEEN :from AND :to)', { org: b.organizationId, from: b.fromDate, to: b.toDate })
        .andWhere('lot_id IN (SELECT l.id FROM stock_lots l WHERE l.organization_id = :org AND l.supplier_id = :sup)', { sup: b.supplierId });
      if (b.itemId) qb.andWhere('item_id = :item', { item: b.itemId });
      if (b.lotId) qb.andWhere('lot_id = :lot', { lot: b.lotId });
      stamped += (await qb.execute()).affected ?? 0;

      if ((b.transportCharges ?? 0) > 0) {
        const lq = this.stockLots.createQueryBuilder().update(StockLot).set({ freightBillId: b.id })
          .where('freight_bill_id IS NULL')
          .andWhere('organization_id = :org', { org: b.organizationId })
          .andWhere('supplier_id = :sup', { sup: b.supplierId });
        if (b.lotId) lq.andWhere('id = :lot', { lot: b.lotId });
        else {
          lq.andWhere('arrival_id IN (SELECT a.id::text FROM arrivals a WHERE a.organization_id = :org AND a.supplier_id = :sup AND a.date BETWEEN :from AND :to)', { from: b.fromDate, to: b.toDate });
          if (b.itemId) lq.andWhere('item_id = :item', { item: b.itemId });
        }
        await lq.execute();
      }
    }
    if (stamped > 0) this.logger.log(`Settlement backfill: stamped ${stamped} sale line(s) with their bill`);
  }

  /**
   * Freight (bhada) carried by the lots being settled, fetched from their
   * Arrival Entries — never typed in at settlement time.
   * Each lot's share = arrival freight × lot weight / arrival weight (a
   * single-lot arrival → the whole amount). A lot's freight is deducted
   * exactly once: on the first bill that settles its sales.
   */
  async transportForLots(
    organizationId: string,
    lotIds: string[],
  ): Promise<{ transport: number; transportDetail: TransportShare[]; freightLotIds: string[] }> {
    const none = { transport: 0, transportDetail: [] as TransportShare[], freightLotIds: [] as string[] };
    if (lotIds.length === 0) return none;
    const lots = await this.stockLots.find({ where: { id: In(lotIds), organizationId, freightBillId: IsNull() } });
    if (lots.length === 0) return none;
    const arrivals = await this.arrivals.find({
      where: { id: In([...new Set(lots.map((l) => l.arrivalId))]), organizationId },
      relations: ['lines'],
      order: { date: 'ASC', arrivalNumber: 'ASC' },
    });
    const shares: TransportShare[] = [];
    const freightLotIds: string[] = [];
    for (const arrival of arrivals) {
      const lines = arrival.lines ?? [];
      const mine = lots.filter((l) => l.arrivalId === arrival.id);
      freightLotIds.push(...mine.map((l) => l.id));
      const freight = arrival.transportCharges ?? 0;
      const arrivalWeight = round2(lines.reduce((s, l) => s + (l.weight ?? 0), 0)) || arrival.totalWeight || 0;
      const shareWeight = round2(mine.reduce((s, l) => s + (lines.find((x) => x.lotNumber === l.lotNumber)?.weight ?? l.weightArrived), 0));
      if (freight <= 0 || shareWeight <= 0 || arrivalWeight <= 0) continue;
      const amount = shareWeight >= arrivalWeight ? round2(freight) : round2((freight * shareWeight) / arrivalWeight);
      shares.push({
        arrivalId: arrival.id,
        arrivalNumber: arrival.arrivalNumber,
        arrivalDate: arrival.date,
        arrivalTransport: round2(freight),
        shareWeight,
        arrivalWeight,
        amount,
      });
    }
    return { transport: round2(shares.reduce((s, x) => s + x.amount, 0)), transportDetail: shares, freightLotIds };
  }

  /**
   * Unadjusted advance payments made against the given lots, oldest first
   * (date, then entry order). These are adjusted on the bill that settles the lots.
   */
  async advancesForLots(organizationId: string, lotIds: string[]): Promise<AdvanceRow[]> {
    if (lotIds.length === 0) return [];
    const [payments, lots] = await Promise.all([
      this.payments.find({ where: { organizationId, lotId: In(lotIds), billId: IsNull() }, order: { date: 'ASC', createdAt: 'ASC' } }),
      this.stockLots.find({ where: { id: In(lotIds), organizationId } }),
    ]);
    const lotNo = new Map(lots.map((l) => [l.id, l.lotNumber]));
    return payments.map((p) => ({
      paymentId: p.id,
      paymentNumber: p.paymentNumber,
      date: p.date,
      amount: p.amount,
      paymentMode: p.paymentMode,
      lotId: p.lotId as string,
      lotNumber: lotNo.get(p.lotId as string) ?? '—',
      reference: p.reference,
    }));
  }

  /** Bill numbers that already settled sale lines in the given scope. */
  private async billsCovering(
    organizationId: string,
    supplierId: string,
    fromDate: string,
    toDate: string,
    itemId?: string,
    lotId?: string,
  ): Promise<string[]> {
    const qb = this.saleLines
      .createQueryBuilder('sl')
      .innerJoin('stock_lots', 'lot', 'lot.id = sl.lot_id')
      .innerJoin('sales', 's', 's.id = sl.sale_id')
      .innerJoin('supplier_bills', 'b', 'b.id = sl.supplier_bill_id')
      .select('DISTINCT b.bill_number', 'billNumber')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('lot.supplier_id = :supplierId', { supplierId })
      .andWhere('s.date BETWEEN :fromDate AND :toDate', { fromDate, toDate });
    if (itemId) qb.andWhere('sl.item_id = :itemId', { itemId });
    if (lotId) qb.andWhere('sl.lot_id = :lotId', { lotId });
    const rows = await qb.getRawMany<{ billNumber: string }>();
    return rows.map((r) => r.billNumber).sort();
  }

  /**
   * Aggregate a supplier's sold-lot figures. Only lot-linked sale lines are
   * attributable to a supplier (a sale line with no lot can't be traced to one).
   */
  async aggregateSupplierSales(
    organizationId: string,
    supplierId: string,
    fromDate?: string,
    toDate?: string,
    itemId?: string,
    lotId?: string,
  ): Promise<SupplierSalesAgg> {
    const qb = this.saleLines
      .createQueryBuilder('sl')
      .innerJoin('stock_lots', 'lot', 'lot.id = sl.lot_id')
      .innerJoin('sales', 's', 's.id = sl.sale_id')
      // Dual-rate lines settle at the supplier-basis gross; the customer-rate
      // gross (and the margin between them) never reaches the supplier.
      .select('COALESCE(SUM(COALESCE(sl.supplier_gross_amount, sl.gross_amount)),0)', 'gross')
      .addSelect('COALESCE(SUM(sl.commission_amount),0)', 'commission')
      .addSelect('COALESCE(SUM(sl.market_fee_amount),0)', 'marketFee')
      .addSelect('COALESCE(SUM(sl.net_amount),0)', 'net')
      .addSelect('COUNT(sl.id)', 'cnt')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('lot.supplier_id = :supplierId', { supplierId })
      // A sale line is settled once — lines already on a bill never re-aggregate.
      .andWhere('sl.supplier_bill_id IS NULL');
    if (fromDate && toDate) {
      qb.andWhere('s.date BETWEEN :fromDate AND :toDate', { fromDate, toDate });
    }
    if (itemId) qb.andWhere('sl.item_id = :itemId', { itemId });
    if (lotId) qb.andWhere('sl.lot_id = :lotId', { lotId });
    const raw = await qb.getRawOne<{
      gross: string; commission: string; marketFee: string; net: string; cnt: string;
    }>();
    return {
      gross: round2(parseFloat(raw?.gross ?? '0')),
      commission: round2(parseFloat(raw?.commission ?? '0')),
      marketFee: round2(parseFloat(raw?.marketFee ?? '0')),
      net: round2(parseFloat(raw?.net ?? '0')),
      saleLineCount: parseInt(raw?.cnt ?? '0', 10),
    };
  }

  /** Net sales attributable to each supplier (all time), for outstanding. */
  async netSalesBySupplier(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.saleLines
      .createQueryBuilder('sl')
      .innerJoin('stock_lots', 'lot', 'lot.id = sl.lot_id')
      .innerJoin('sales', 's', 's.id = sl.sale_id')
      .select('lot.supplier_id', 'supplierId')
      .addSelect('SUM(sl.net_amount)', 'net')
      .where('s.organization_id = :organizationId', { organizationId })
      .groupBy('lot.supplier_id')
      .getRawMany<{ supplierId: string; net: string }>();
    return new Map(rows.map((r) => [r.supplierId, parseFloat(r.net)]));
  }

  /**
   * Per-lot sold figures for a settlement preview, so the user sees exactly
   * which lots the bill will cover. Supplier-basis amounts (dual-rate safe).
   */
  async lotBreakdown(
    organizationId: string,
    supplierId: string,
    fromDate: string,
    toDate: string,
    itemId?: string,
    lotId?: string,
  ): Promise<LotBreakdownRow[]> {
    const qb = this.saleLines
      .createQueryBuilder('sl')
      .innerJoin('stock_lots', 'lot', 'lot.id = sl.lot_id')
      .innerJoin('sales', 's', 's.id = sl.sale_id')
      .select('lot.id', 'lotId')
      .addSelect('lot.lot_number', 'lotNumber')
      .addSelect('sl.item_id', 'itemId')
      .addSelect('COALESCE(SUM(sl.quantity),0)', 'qty')
      .addSelect('COALESCE(SUM(sl.weight),0)', 'weight')
      .addSelect('COALESCE(SUM(COALESCE(sl.supplier_gross_amount, sl.gross_amount)),0)', 'gross')
      .addSelect('COALESCE(SUM(sl.net_amount),0)', 'net')
      .addSelect('COUNT(sl.id)', 'lines')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('lot.supplier_id = :supplierId', { supplierId })
      .andWhere('sl.supplier_bill_id IS NULL')
      .andWhere('s.date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .groupBy('lot.id')
      .addGroupBy('lot.lot_number')
      .addGroupBy('sl.item_id')
      .orderBy('lot.lot_number', 'ASC');
    if (itemId) qb.andWhere('sl.item_id = :itemId', { itemId });
    if (lotId) qb.andWhere('sl.lot_id = :lotId', { lotId });
    const rows = await qb.getRawMany<{
      lotId: string; lotNumber: string; itemId: string;
      qty: string; weight: string; gross: string; net: string; lines: string;
    }>();
    return rows.map((r) => ({
      lotId: r.lotId,
      lotNumber: r.lotNumber,
      itemId: r.itemId,
      qty: round2(parseFloat(r.qty)),
      weight: round2(parseFloat(r.weight)),
      gross: round2(parseFloat(r.gross)),
      net: round2(parseFloat(r.net)),
      lines: parseInt(r.lines, 10),
    }));
  }

  async previewBill(
    organizationId: string,
    supplierId: string,
    fromDate: string,
    toDate: string,
    itemId?: string,
    lotId?: string,
  ): Promise<SupplierBillPreview> {
    const [agg, lots] = await Promise.all([
      this.aggregateSupplierSales(organizationId, supplierId, fromDate, toDate, itemId, lotId),
      this.lotBreakdown(organizationId, supplierId, fromDate, toDate, itemId, lotId),
    ]);
    // Freight follows the lots whose sales this bill settles (from their arrivals).
    const freight = await this.transportForLots(organizationId, lots.map((l) => l.lotId));
    const settledBy = agg.saleLineCount === 0
      ? await this.billsCovering(organizationId, supplierId, fromDate, toDate, itemId, lotId)
      : [];
    const advances = await this.advancesForLots(organizationId, lots.map((l) => l.lotId));
    const advanceTotal = round2(advances.reduce((s, a) => s + a.amount, 0));
    return { ...agg, transport: freight.transport, transportDetail: freight.transportDetail, settledBy, lots, advances, advanceTotal };
  }

  async createBill(user: AuthUser, dto: CreateBillInput): Promise<SupplierBill> {
    const organizationId = user.organizationId!;
    const [agg, lots] = await Promise.all([
      this.aggregateSupplierSales(organizationId, dto.supplierId, dto.fromDate, dto.toDate, dto.itemId, dto.lotId),
      this.lotBreakdown(organizationId, dto.supplierId, dto.fromDate, dto.toDate, dto.itemId, dto.lotId),
    ]);
    if (agg.saleLineCount === 0) {
      const covered = await this.billsCovering(organizationId, dto.supplierId, dto.fromDate, dto.toDate, dto.itemId, dto.lotId);
      throw new BadRequestException(
        covered.length
          ? `Nothing left to settle — these sales are already covered by ${covered.join(', ')}.`
          : 'No unsettled sales for this supplier in the selected range.',
      );
    }
    // Same freight rule as the preview — the bill stores the apportioned amount.
    const freight = await this.transportForLots(organizationId, lots.map((l) => l.lotId));
    const transport = freight.transport;
    const labour = dto.labourCharges ?? 0;
    const crate = dto.crateCharges ?? 0;
    const other = dto.otherCharges ?? 0;
    const netPayable = round2(agg.net - transport - labour - crate - other);
    // Advances already paid against these lots are adjusted now, oldest first.
    const advances = await this.advancesForLots(organizationId, lots.map((l) => l.lotId));
    const advanceAdjusted = round2(advances.reduce((s, a) => s + a.amount, 0));
    const billNumber = await this.nextBillNumber(organizationId);

    return this.bills.manager.transaction(async (manager) => {
      const bill = await manager.save(
        manager.create(SupplierBill, {
          organizationId,
          branchId: user.branchId!,
          billNumber,
          date: dto.date,
          supplierId: dto.supplierId,
          itemId: dto.itemId ?? null,
          lotId: dto.lotId ?? null,
          fromDate: dto.fromDate,
          toDate: dto.toDate,
          grossSales: agg.gross,
          commissionAmount: agg.commission,
          marketFeeAmount: agg.marketFee,
          transportCharges: transport,
          labourCharges: labour,
          crateCharges: crate,
          otherCharges: other,
          netPayable,
          advanceAdjusted,
          // Fully covered by advances → nothing left to pay.
          status: advanceAdjusted >= netPayable && netPayable > 0 ? SupplierBillStatus.PAID : SupplierBillStatus.FINALISED,
          notes: dto.notes,
          createdByUserId: user.id,
        }),
      );

      // Link the adjusted advances to this bill so they are never adjusted twice.
      if (advances.length > 0) {
        await manager.update(SupplierPayment, { id: In(advances.map((a) => a.paymentId)), billId: IsNull() }, { billId: bill.id });
      }

      // Stamp every line this bill settles so no later bill can pick it up again.
      const stamp = manager.createQueryBuilder().update(SaleLine).set({ supplierBillId: bill.id })
        .where('supplier_bill_id IS NULL')
        .andWhere('sale_id IN (SELECT s.id FROM sales s WHERE s.organization_id = :org AND s.date BETWEEN :from AND :to)', { org: organizationId, from: dto.fromDate, to: dto.toDate })
        .andWhere('lot_id IN (SELECT l.id FROM stock_lots l WHERE l.organization_id = :org AND l.supplier_id = :sup)', { sup: dto.supplierId });
      if (dto.itemId) stamp.andWhere('item_id = :item', { item: dto.itemId });
      if (dto.lotId) stamp.andWhere('lot_id = :lot', { lot: dto.lotId });
      await stamp.execute();

      // Freight for these lots is now charged — never again.
      if (freight.freightLotIds.length > 0) {
        await manager.update(StockLot, { id: In(freight.freightLotIds), freightBillId: IsNull() }, { freightBillId: bill.id });
      }
      return bill;
    });
  }

  listBills(organizationId: string, branchId: string, supplierId?: string): Promise<SupplierBill[]> {
    return this.bills.find({
      where: { organizationId, branchId, ...(supplierId ? { supplierId } : {}) },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
  }

  async findBill(organizationId: string, id: string): Promise<SupplierBill> {
    const bill = await this.bills.findOne({ where: { id, organizationId } });
    if (!bill) throw new NotFoundException('Supplier bill not found');
    return bill;
  }

  async createPayment(user: AuthUser, dto: CreatePaymentInput): Promise<SupplierPayment> {
    const organizationId = user.organizationId!;
    if (dto.lotId) {
      const lot = await this.stockLots.findOne({ where: { id: dto.lotId, organizationId } });
      if (!lot) throw new NotFoundException('Stock lot not found');
      if (lot.supplierId !== dto.supplierId) throw new BadRequestException('This lot does not belong to the selected supplier');
    }
    const paymentNumber = await this.nextPaymentNumber(organizationId);
    const payment = await this.payments.save(
      this.payments.create({
        organizationId,
        branchId: user.branchId!,
        paymentNumber,
        date: dto.date,
        supplierId: dto.supplierId,
        amount: dto.amount,
        paymentMode: dto.paymentMode ?? PaymentMode.CASH,
        billId: dto.billId ?? null,
        lotId: dto.lotId ?? null,
        reference: dto.reference,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
    // If the payment clears a specific bill, mark it paid.
    if (dto.billId) {
      await this.bills.update(
        { id: dto.billId, organizationId },
        { status: SupplierBillStatus.PAID },
      );
    }
    return payment;
  }

  listPayments(organizationId: string, branchId: string, supplierId?: string): Promise<SupplierPayment[]> {
    return this.payments.find({
      where: { organizationId, branchId, ...(supplierId ? { supplierId } : {}) },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
  }

  async paymentsBySupplier(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.payments
      .createQueryBuilder('p')
      .select('p.supplier_id', 'supplierId')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.organization_id = :organizationId', { organizationId })
      .groupBy('p.supplier_id')
      .getRawMany<{ supplierId: string; total: string }>();
    return new Map(rows.map((r) => [r.supplierId, parseFloat(r.total)]));
  }

  /** Σ netPayable per supplier across all bills (recognised supplier dues). */
  async billNetBySupplier(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.bills
      .createQueryBuilder('b')
      .select('b.supplier_id', 'supplierId')
      .addSelect('SUM(b.net_payable)', 'net')
      .where('b.organization_id = :organizationId', { organizationId })
      .groupBy('b.supplier_id')
      .getRawMany<{ supplierId: string; net: string }>();
    return new Map(rows.map((r) => [r.supplierId, parseFloat(r.net)]));
  }

  /** Σ (grossSales − commission − marketFee) per supplier — sales net already billed. */
  async billedSalesNetBySupplier(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.bills
      .createQueryBuilder('b')
      .select('b.supplier_id', 'supplierId')
      .addSelect('SUM(b.gross_sales - b.commission_amount - b.market_fee_amount)', 'net')
      .where('b.organization_id = :organizationId', { organizationId })
      .groupBy('b.supplier_id')
      .getRawMany<{ supplierId: string; net: string }>();
    return new Map(rows.map((r) => [r.supplierId, parseFloat(r.net)]));
  }

  /** Settlement-side deductions per supplier from finalised bills (labour/crate/other). */
  async billChargesBySupplier(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.bills
      .createQueryBuilder('b')
      .select('b.supplier_id', 'supplierId')
      .addSelect('SUM(b.labour_charges + b.crate_charges + b.other_charges)', 'charges')
      .where('b.organization_id = :organizationId', { organizationId })
      .groupBy('b.supplier_id')
      .getRawMany<{ supplierId: string; charges: string }>();
    return new Map(rows.map((r) => [r.supplierId, parseFloat(r.charges)]));
  }

  private nextBillNumber(organizationId: string): Promise<string> {
    return nextDocNumber(this.bills.manager, 'supplier_bills', 'bill_number', 'SB', organizationId);
  }

  private nextPaymentNumber(organizationId: string): Promise<string> {
    return nextDocNumber(this.payments.manager, 'supplier_payments', 'payment_number', 'SP', organizationId);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
