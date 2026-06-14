import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { PaymentMode } from '@/common/enums/domain.enum';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { SupplierBill, SupplierBillStatus } from './supplier-bill.entity';
import { SupplierPayment } from './supplier-payment.entity';

export interface SupplierSalesAgg {
  gross: number;
  commission: number;
  marketFee: number;
  net: number;
  saleLineCount: number;
}

interface CreateBillInput {
  supplierId: string;
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
  ) {}

  /**
   * Aggregate a supplier's sold-lot figures. Only lot-linked sale lines are
   * attributable to a supplier (a sale line with no lot can't be traced to one).
   */
  async aggregateSupplierSales(
    organizationId: string,
    supplierId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<SupplierSalesAgg> {
    const qb = this.saleLines
      .createQueryBuilder('sl')
      .innerJoin('stock_lots', 'lot', 'lot.id = sl.lot_id')
      .innerJoin('sales', 's', 's.id = sl.sale_id')
      .select('COALESCE(SUM(sl.gross_amount),0)', 'gross')
      .addSelect('COALESCE(SUM(sl.commission_amount),0)', 'commission')
      .addSelect('COALESCE(SUM(sl.market_fee_amount),0)', 'marketFee')
      .addSelect('COALESCE(SUM(sl.net_amount),0)', 'net')
      .addSelect('COUNT(sl.id)', 'cnt')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('lot.supplier_id = :supplierId', { supplierId });
    if (fromDate && toDate) {
      qb.andWhere('s.date BETWEEN :fromDate AND :toDate', { fromDate, toDate });
    }
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

  async previewBill(organizationId: string, supplierId: string, fromDate: string, toDate: string) {
    return this.aggregateSupplierSales(organizationId, supplierId, fromDate, toDate);
  }

  async createBill(user: AuthUser, dto: CreateBillInput): Promise<SupplierBill> {
    const organizationId = user.organizationId!;
    const agg = await this.aggregateSupplierSales(organizationId, dto.supplierId, dto.fromDate, dto.toDate);
    const labour = dto.labourCharges ?? 0;
    const crate = dto.crateCharges ?? 0;
    const other = dto.otherCharges ?? 0;
    const netPayable = round2(agg.net - labour - crate - other);
    const billNumber = await this.nextBillNumber(organizationId);

    return this.bills.save(
      this.bills.create({
        organizationId,
        branchId: user.branchId!,
        billNumber,
        date: dto.date,
        supplierId: dto.supplierId,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        grossSales: agg.gross,
        commissionAmount: agg.commission,
        marketFeeAmount: agg.marketFee,
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

  private async nextBillNumber(organizationId: string): Promise<string> {
    const count = await this.bills.count({ where: { organizationId } });
    return `SB-${String(count + 1).padStart(4, '0')}`;
  }

  private async nextPaymentNumber(organizationId: string): Promise<string> {
    const count = await this.payments.count({ where: { organizationId } });
    return `SP-${String(count + 1).padStart(4, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
