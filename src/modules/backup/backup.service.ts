import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { Item } from '@/modules/items/item.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Customer } from '@/modules/customers/customer.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Arrival } from '@/modules/arrivals/arrival.entity';
import { ArrivalLine } from '@/modules/arrivals/arrival-line.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Collection } from '@/modules/collections/collection.entity';
import { SupplierBill } from '@/modules/settlements/supplier-bill.entity';
import { SupplierPayment } from '@/modules/settlements/supplier-payment.entity';
import { Expense } from '@/modules/expenses/expense.entity';
import { CrateTransaction } from '@/modules/crates/crate-transaction.entity';
import { Adjustment } from '@/modules/adjustments/adjustment.entity';
import { Challan } from '@/modules/challans/challan.entity';
import { ChallanLine } from '@/modules/challans/challan-line.entity';

/**
 * Per-organization data backup. Strictly tenant-scoped: every record is filtered
 * by the caller's organizationId (child line-tables are filtered through their
 * parents), guaranteeing one tenant can never read another's data.
 */
@Injectable()
export class BackupService {
  constructor(
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(StockLot) private readonly stockLots: Repository<StockLot>,
    @InjectRepository(Arrival) private readonly arrivals: Repository<Arrival>,
    @InjectRepository(ArrivalLine) private readonly arrivalLines: Repository<ArrivalLine>,
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    @InjectRepository(SaleLine) private readonly saleLines: Repository<SaleLine>,
    @InjectRepository(Collection) private readonly collections: Repository<Collection>,
    @InjectRepository(SupplierBill) private readonly supplierBills: Repository<SupplierBill>,
    @InjectRepository(SupplierPayment) private readonly supplierPayments: Repository<SupplierPayment>,
    @InjectRepository(Expense) private readonly expenses: Repository<Expense>,
    @InjectRepository(CrateTransaction) private readonly crates: Repository<CrateTransaction>,
    @InjectRepository(Adjustment) private readonly adjustments: Repository<Adjustment>,
    @InjectRepository(Challan) private readonly challans: Repository<Challan>,
    @InjectRepository(ChallanLine) private readonly challanLines: Repository<ChallanLine>,
  ) {}

  async export(organizationId: string) {
    const org = await this.orgs.findOne({ where: { id: organizationId }, relations: { plan: true } });
    if (!org) throw new NotFoundException('Organization not found');

    const scope = { where: { organizationId } } as const;

    const [
      branches, users, items, suppliers, customers, stockLots,
      arrivals, sales, collections, supplierBills, supplierPayments,
      expenses, crateTransactions, adjustments, challans,
    ] = await Promise.all([
      this.branches.find(scope),
      this.users.find(scope), // secrets (passwordHash/securityAnswerHash) are select:false → excluded
      this.items.find(scope),
      this.suppliers.find(scope),
      this.customers.find(scope),
      this.stockLots.find(scope),
      this.arrivals.find(scope),
      this.sales.find(scope),
      this.collections.find(scope),
      this.supplierBills.find(scope),
      this.supplierPayments.find(scope),
      this.expenses.find(scope),
      this.crates.find(scope),
      this.adjustments.find(scope),
      this.challans.find(scope),
    ]);

    // Child line-tables: filtered via their parents (no organization_id of their own).
    const arrivalLines = arrivals.length
      ? await this.arrivalLines.find({ where: { arrivalId: In(arrivals.map((a) => a.id)) } })
      : [];
    const saleLines = sales.length
      ? await this.saleLines.find({ where: { saleId: In(sales.map((s) => s.id)) } })
      : [];
    const challanLines = challans.length
      ? await this.challanLines.find({ where: { challanId: In(challans.map((c) => c.id)) } })
      : [];

    const data = {
      organization: {
        id: org.id, name: org.name, gstNumber: org.gstNumber, address: org.address,
        mobile: org.mobile, email: org.email, planName: org.plan?.name ?? null,
        subscriptionStatus: org.subscriptionStatus,
      },
      branches, users, items, suppliers, customers, stockLots,
      arrivals, arrivalLines, sales, saleLines, collections,
      supplierBills, supplierPayments, expenses, crateTransactions, adjustments,
      challans, challanLines,
    };

    const recordCounts = Object.fromEntries(
      Object.entries(data)
        .filter(([k]) => k !== 'organization')
        .map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
    );

    return {
      meta: {
        format: 'mandi-erp-backup',
        version: 1,
        organizationId: org.id,
        organizationName: org.name,
        exportedAt: new Date().toISOString(),
        recordCounts,
      },
      data,
    };
  }
}
