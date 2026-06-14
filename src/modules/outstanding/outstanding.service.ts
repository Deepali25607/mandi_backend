import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { CollectionsService } from '@/modules/collections/collections.service';
import { SettlementsService } from '@/modules/settlements/settlements.service';
import { AdjustmentsService } from '@/modules/adjustments/adjustments.service';

export interface CustomerOutstandingRow {
  customerId: string;
  code: string;
  name: string;
  area?: string;
  opening: number;
  sales: number;
  collected: number;
  balance: number;
}

export interface SupplierOutstandingRow {
  supplierId: string;
  code: string;
  name: string;
  village?: string;
  opening: number;
  billed: number; // recognised dues from finalised bills (net payable)
  adjustments: number; // signed rate/weight adjustment effect
  paid: number;
  balance: number;
  salesNet: number; // informational: total net sales attributable (all time)
  unbilled: number; // sales net not yet settled into a bill
}

export interface AgingBucket {
  label: string;
  value: number;
}

const BUCKETS = [
  { label: '0-7 days', maxAge: 7 },
  { label: '8-15 days', maxAge: 15 },
  { label: '16-30 days', maxAge: 30 },
  { label: '30+ days', maxAge: Infinity },
];

@Injectable()
export class OutstandingService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    private readonly collectionsService: CollectionsService,
    private readonly settlementsService: SettlementsService,
    private readonly adjustmentsService: AdjustmentsService,
  ) {}

  async customerOutstanding(organizationId: string): Promise<CustomerOutstandingRow[]> {
    const [customers, collectedMap, salesByCust] = await Promise.all([
      this.customers.find({ where: { organizationId } }),
      this.collectionsService.totalsByCustomer(organizationId),
      this.salesGrossByCustomer(organizationId),
    ]);

    return customers
      .map((c) => {
        const opening = c.openingBalance ?? 0;
        const sales = salesByCust.get(c.id) ?? 0;
        const collected = collectedMap.get(c.id) ?? 0;
        return {
          customerId: c.id,
          code: c.code,
          name: c.name,
          area: c.area,
          opening,
          sales: round2(sales),
          collected: round2(collected),
          balance: round2(opening + sales - collected),
        };
      })
      .filter((r) => Math.abs(r.balance) > 0.01)
      .sort((a, b) => b.balance - a.balance);
  }

  async supplierOutstanding(organizationId: string): Promise<SupplierOutstandingRow[]> {
    const [suppliers, salesNetMap, billNetMap, billedSalesNetMap, paidMap, adjMap] = await Promise.all([
      this.suppliers.find({ where: { organizationId } }),
      this.settlementsService.netSalesBySupplier(organizationId),
      this.settlementsService.billNetBySupplier(organizationId),
      this.settlementsService.billedSalesNetBySupplier(organizationId),
      this.settlementsService.paymentsBySupplier(organizationId),
      this.adjustmentsService.totalsBySupplier(organizationId),
    ]);

    return suppliers
      .map((s) => {
        const opening = s.openingBalance ?? 0;
        const billed = billNetMap.get(s.id) ?? 0;
        const paid = paidMap.get(s.id) ?? 0;
        const adjustments = adjMap.get(s.id) ?? 0;
        const salesNet = salesNetMap.get(s.id) ?? 0;
        const billedSalesNet = billedSalesNetMap.get(s.id) ?? 0;
        return {
          supplierId: s.id,
          code: s.code,
          name: s.name,
          village: s.village,
          opening,
          // Dues are recognised when a bill is finalised (BRD Module 6),
          // plus signed rate/weight adjustments (BRD Module 5).
          billed: round2(billed),
          adjustments: round2(adjustments),
          paid: round2(paid),
          balance: round2(opening + billed + adjustments - paid),
          salesNet: round2(salesNet),
          unbilled: round2(salesNet - billedSalesNet),
        };
      })
      .filter((r) => Math.abs(r.balance) > 0.01 || Math.abs(r.unbilled) > 0.01)
      .sort((a, b) => b.balance - a.balance);
  }

  async summary(organizationId: string): Promise<{ receivable: number; payable: number }> {
    const [cust, sup] = await Promise.all([
      this.customerOutstanding(organizationId),
      this.supplierOutstanding(organizationId),
    ]);
    return {
      receivable: round2(cust.reduce((s, r) => s + Math.max(0, r.balance), 0)),
      payable: round2(sup.reduce((s, r) => s + Math.max(0, r.balance), 0)),
    };
  }

  /** FIFO aging of customer receivables (approximate — see IMPLEMENTATION_LOG). */
  async customerAging(organizationId: string, asOf = new Date()): Promise<AgingBucket[]> {
    const [sales, collectedMap, customers] = await Promise.all([
      this.sales.find({
        where: { organizationId },
        select: { id: true, customerId: true, date: true, grossAmount: true },
      }),
      this.collectionsService.totalsByCustomer(organizationId),
      this.customers.find({ where: { organizationId }, select: { id: true, openingBalance: true } }),
    ]);

    const byCustomer = new Map<string, { date: string; gross: number }[]>();
    for (const s of sales) {
      if (!byCustomer.has(s.customerId)) byCustomer.set(s.customerId, []);
      byCustomer.get(s.customerId)!.push({ date: s.date, gross: s.grossAmount });
    }
    const openingMap = new Map(customers.map((c) => [c.id, c.openingBalance ?? 0]));

    const totals = BUCKETS.map((b) => ({ label: b.label, value: 0 }));
    const allCustomerIds = new Set<string>([...byCustomer.keys(), ...openingMap.keys()]);

    for (const customerId of allCustomerIds) {
      let collected = collectedMap.get(customerId) ?? 0;
      // Opening balance = oldest receivable (treated as 30+).
      const opening = openingMap.get(customerId) ?? 0;
      const items: { age: number; amount: number }[] = [];
      if (opening > 0) items.push({ age: Infinity, amount: opening });
      const custSales = (byCustomer.get(customerId) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      for (const s of custSales) {
        items.push({ age: ageInDays(s.date, asOf), amount: s.gross });
      }
      // Apply collections FIFO (oldest first).
      for (const item of items) {
        if (collected <= 0) break;
        const applied = Math.min(item.amount, collected);
        item.amount -= applied;
        collected -= applied;
      }
      for (const item of items) {
        if (item.amount <= 0.01) continue;
        const idx = BUCKETS.findIndex((b) => item.age <= b.maxAge);
        totals[idx === -1 ? BUCKETS.length - 1 : idx].value += item.amount;
      }
    }
    return totals.map((t) => ({ label: t.label, value: round2(t.value) }));
  }

  private async salesGrossByCustomer(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.sales
      .createQueryBuilder('s')
      .select('s.customer_id', 'customerId')
      .addSelect('SUM(s.gross_amount)', 'gross')
      .where('s.organization_id = :organizationId', { organizationId })
      .groupBy('s.customer_id')
      .getRawMany<{ customerId: string; gross: string }>();
    return new Map(rows.map((r) => [r.customerId, parseFloat(r.gross)]));
  }
}

function ageInDays(dateStr: string, asOf: Date): number {
  const d = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.floor((asOf.getTime() - d.getTime()) / 86400000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
