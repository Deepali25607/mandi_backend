import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { Item } from '@/modules/items/item.entity';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
import { Collection } from '@/modules/collections/collection.entity';
import { InventoryService } from '@/modules/inventory/inventory.service';
import { OutstandingService } from '@/modules/outstanding/outstanding.service';
import { SettlementsService } from '@/modules/settlements/settlements.service';

export interface KpiCard {
  key: string;
  label: string;
  value: number;
  format: 'currency' | 'count';
  deltaPct?: number;
  icon: string;
}
export interface SeriesPoint {
  label: string;
  value: number;
}
export interface DashboardData {
  asOf: string;
  isDemoData: boolean;
  kpis: KpiCard[];
  charts: {
    dailySalesTrend: SeriesPoint[];
    collectionTrend: SeriesPoint[];
    outstandingAnalysis: SeriesPoint[];
    itemWiseSales: SeriesPoint[];
    customerWiseSales: SeriesPoint[];
    supplierWiseSales: SeriesPoint[];
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    @InjectRepository(SaleLine) private readonly saleLines: Repository<SaleLine>,
    @InjectRepository(Arrival) private readonly arrivals: Repository<Arrival>,
    @InjectRepository(Collection) private readonly collections: Repository<Collection>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    private readonly inventoryService: InventoryService,
    private readonly outstandingService: OutstandingService,
    private readonly settlementsService: SettlementsService,
  ) {}

  /** Real, tenant-scoped KPIs and charts (BRD Module 18). */
  async getOverview(user: AuthUser): Promise<DashboardData> {
    const organizationId = user.organizationId!;
    const branchId = user.branchId ?? '';
    const today = toDateStr(new Date());
    const last7 = lastNDates(7);

    const [
      todaySales,
      todayArrival,
      todayCollections,
      todayCommission,
      todayMarketFee,
      inventory,
      outstanding,
      aging,
      salesTrend,
      collectionTrend,
      itemWise,
      customerWise,
      supplierWise,
    ] = await Promise.all([
      this.sumSales(organizationId, branchId, today, today),
      this.sumArrivals(organizationId, branchId, today),
      this.sumCollections(organizationId, branchId, today, today),
      this.sumSaleField(organizationId, branchId, 'commission_amount', today),
      this.sumSaleField(organizationId, branchId, 'market_fee_amount', today),
      this.inventoryService.summary(organizationId, branchId),
      this.outstandingService.summary(organizationId),
      this.outstandingService.customerAging(organizationId),
      this.salesByDay(organizationId, branchId, last7),
      this.collectionsByDay(organizationId, branchId, last7),
      this.topItemsBySales(organizationId),
      this.topCustomersBySales(organizationId),
      this.topSuppliersByNet(organizationId),
    ]);

    const inventoryValue = inventory.reduce((s, r) => s + r.stockValue, 0);
    const grossProfit = round2(todayCommission + todayMarketFee);

    return {
      asOf: new Date().toISOString(),
      isDemoData: false,
      kpis: [
        { key: 'todayArrival', label: "Today's Arrival", value: round2(todayArrival), format: 'currency', icon: 'truck' },
        { key: 'todaySales', label: "Today's Sales", value: round2(todaySales), format: 'currency', icon: 'cart' },
        { key: 'todayCollections', label: "Today's Collections", value: round2(todayCollections), format: 'currency', icon: 'cash' },
        { key: 'outstandingReceivable', label: 'Outstanding Receivable', value: outstanding.receivable, format: 'currency', icon: 'receivable' },
        { key: 'outstandingPayable', label: 'Outstanding Payable', value: outstanding.payable, format: 'currency', icon: 'payable' },
        { key: 'inventoryValue', label: 'Inventory Value', value: round2(inventoryValue), format: 'currency', icon: 'box' },
        { key: 'commissionEarned', label: "Commission (today)", value: round2(todayCommission), format: 'currency', icon: 'percent' },
        { key: 'grossProfit', label: 'Gross Profit (today)', value: grossProfit, format: 'currency', icon: 'trend' },
      ],
      charts: {
        dailySalesTrend: salesTrend,
        collectionTrend,
        outstandingAnalysis: aging,
        itemWiseSales: itemWise,
        customerWiseSales: customerWise,
        supplierWiseSales: supplierWise,
      },
    };
  }

  private async sumSales(org: string, branch: string, from: string, to: string): Promise<number> {
    const r = await this.sales
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.gross_amount),0)', 'v')
      .where('s.organization_id = :org', { org })
      .andWhere('s.branch_id = :branch', { branch })
      .andWhere('s.date BETWEEN :from AND :to', { from, to })
      .getRawOne<{ v: string }>();
    return parseFloat(r?.v ?? '0');
  }

  private async sumSaleField(org: string, branch: string, field: string, date: string): Promise<number> {
    const r = await this.sales
      .createQueryBuilder('s')
      .select(`COALESCE(SUM(s.${field}),0)`, 'v')
      .where('s.organization_id = :org', { org })
      .andWhere('s.branch_id = :branch', { branch })
      .andWhere('s.date = :date', { date })
      .getRawOne<{ v: string }>();
    return parseFloat(r?.v ?? '0');
  }

  private async sumArrivals(org: string, branch: string, date: string): Promise<number> {
    const r = await this.arrivals
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.total_value),0)', 'v')
      .where('a.organization_id = :org', { org })
      .andWhere('a.branch_id = :branch', { branch })
      .andWhere('a.date = :date', { date })
      .getRawOne<{ v: string }>();
    return parseFloat(r?.v ?? '0');
  }

  private async sumCollections(org: string, branch: string, from: string, to: string): Promise<number> {
    const r = await this.collections
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount),0)', 'v')
      .where('c.organization_id = :org', { org })
      .andWhere('c.branch_id = :branch', { branch })
      .andWhere('c.date BETWEEN :from AND :to', { from, to })
      .getRawOne<{ v: string }>();
    return parseFloat(r?.v ?? '0');
  }

  private async salesByDay(org: string, branch: string, dates: string[]): Promise<SeriesPoint[]> {
    const rows = await this.sales
      .createQueryBuilder('s')
      .select("TO_CHAR(s.date, 'YYYY-MM-DD')", 'date')
      .addSelect('SUM(s.gross_amount)', 'total')
      .where('s.organization_id = :org', { org })
      .andWhere('s.branch_id = :branch', { branch })
      .andWhere('s.date IN (:...dates)', { dates })
      .groupBy('s.date')
      .getRawMany<{ date: string; total: string }>();
    return this.fillSeries(dates, rows);
  }

  private async collectionsByDay(org: string, branch: string, dates: string[]): Promise<SeriesPoint[]> {
    const rows = await this.collections
      .createQueryBuilder('c')
      .select("TO_CHAR(c.date, 'YYYY-MM-DD')", 'date')
      .addSelect('SUM(c.amount)', 'total')
      .where('c.organization_id = :org', { org })
      .andWhere('c.branch_id = :branch', { branch })
      .andWhere('c.date IN (:...dates)', { dates })
      .groupBy('c.date')
      .getRawMany<{ date: string; total: string }>();
    return this.fillSeries(dates, rows);
  }

  private fillSeries(dates: string[], rows: { date: string; total: string }[]): SeriesPoint[] {
    const map = new Map(rows.map((r) => [normalizeDate(r.date), parseFloat(r.total)]));
    return dates.map((d) => ({
      label: new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }),
      value: round2(map.get(d) ?? 0),
    }));
  }

  private async topItemsBySales(org: string): Promise<SeriesPoint[]> {
    const rows = await this.saleLines
      .createQueryBuilder('sl')
      .innerJoin('sales', 's', 's.id = sl.sale_id')
      .select('sl.item_id', 'itemId')
      .addSelect('SUM(sl.gross_amount)', 'total')
      .where('s.organization_id = :org', { org })
      .groupBy('sl.item_id')
      .orderBy('total', 'DESC')
      .limit(6)
      .getRawMany<{ itemId: string; total: string }>();
    const items = await this.items.find({ where: { organizationId: org } });
    const names = new Map(items.map((i) => [i.id, i.name]));
    return rows.map((r) => ({ label: names.get(r.itemId) ?? 'Item', value: round2(parseFloat(r.total)) }));
  }

  private async topCustomersBySales(org: string): Promise<SeriesPoint[]> {
    const rows = await this.sales
      .createQueryBuilder('s')
      .select('s.customer_id', 'customerId')
      .addSelect('SUM(s.gross_amount)', 'total')
      .where('s.organization_id = :org', { org })
      .groupBy('s.customer_id')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany<{ customerId: string; total: string }>();
    const customers = await this.customers.find({ where: { organizationId: org } });
    const names = new Map(customers.map((c) => [c.id, c.name]));
    return rows.map((r) => ({ label: names.get(r.customerId) ?? 'Customer', value: round2(parseFloat(r.total)) }));
  }

  private async topSuppliersByNet(org: string): Promise<SeriesPoint[]> {
    const netMap = await this.settlementsService.netSalesBySupplier(org);
    const suppliers = await this.suppliers.find({ where: { organizationId: org } });
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    return [...netMap.entries()]
      .map(([supplierId, net]) => ({ label: names.get(supplierId) ?? 'Supplier', value: round2(net) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function normalizeDate(d: string): string {
  return d.length > 10 ? d.slice(0, 10) : d;
}
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(toDateStr(d));
  }
  return out;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
