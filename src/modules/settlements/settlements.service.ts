import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { nextDocNumber } from '@/common/utils/doc-number.util';
import { PaymentMode } from '@/common/enums/domain.enum';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
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

/** Sales aggregate plus transport + the lot-wise detail for a settlement preview. */
export interface SupplierBillPreview extends SupplierSalesAgg {
  transport: number;
  lots: LotBreakdownRow[];
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
  reference?: string;
  notes?: string;
}

@Injectable()
export class SettlementsService {
  constructor(
    @InjectRepository(SupplierBill) private readonly bills: Repository<SupplierBill>,
    @InjectRepository(SupplierPayment) private readonly payments: Repository<SupplierPayment>,
    @InjectRepository(SaleLine) private readonly saleLines: Repository<SaleLine>,
    @InjectRepository(Arrival) private readonly arrivals: Repository<Arrival>,
  ) {}

  /** Total transport (bhada) on a supplier's arrivals within [fromDate, toDate]. */
  async transportForSupplier(
    organizationId: string,
    supplierId: string,
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    const arrivals = await this.arrivals.find({
      where: { organizationId, supplierId, date: Between(fromDate, toDate) },
      select: { transportCharges: true },
    });
    return round2(arrivals.reduce((s, a) => s + (a.transportCharges ?? 0), 0));
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
      .andWhere('lot.supplier_id = :supplierId', { supplierId });
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
    const [agg, transport, lots] = await Promise.all([
      this.aggregateSupplierSales(organizationId, supplierId, fromDate, toDate, itemId, lotId),
      // Transport belongs to a whole arrival (often several items/lots), so it
      // is only auto-deducted on all-items settlements — an item/lot-wise bill
      // would otherwise deduct the same bhada several times.
      itemId || lotId
        ? Promise.resolve(0)
        : this.transportForSupplier(organizationId, supplierId, fromDate, toDate),
      this.lotBreakdown(organizationId, supplierId, fromDate, toDate, itemId, lotId),
    ]);
    return { ...agg, transport, lots };
  }

  async createBill(user: AuthUser, dto: CreateBillInput): Promise<SupplierBill> {
    const organizationId = user.organizationId!;
    const [agg, transport] = await Promise.all([
      this.aggregateSupplierSales(organizationId, dto.supplierId, dto.fromDate, dto.toDate, dto.itemId, dto.lotId),
      // Same transport rule as the preview: auto-deduct only on all-items bills.
      dto.itemId || dto.lotId
        ? Promise.resolve(0)
        : this.transportForSupplier(organizationId, dto.supplierId, dto.fromDate, dto.toDate),
    ]);
    const labour = dto.labourCharges ?? 0;
    const crate = dto.crateCharges ?? 0;
    const other = dto.otherCharges ?? 0;
    const netPayable = round2(agg.net - transport - labour - crate - other);
    const billNumber = await this.nextBillNumber(organizationId);

    return this.bills.save(
      this.bills.create({
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
        status: SupplierBillStatus.FINALISED,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
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
