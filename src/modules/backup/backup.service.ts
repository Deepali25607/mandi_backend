import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget, In, ObjectLiteral, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { verifySecret } from '@/common/utils/password.util';
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
import { BankAccount } from '@/modules/bank-accounts/bank-account.entity';
import { CashTransfer } from '@/modules/cash-transfers/cash-transfer.entity';
import { ItemPrice } from '@/modules/item-prices/item-price.entity';

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
    private readonly dataSource: DataSource,
  ) {}

  async export(organizationId: string) {
    const org = await this.orgs.findOne({ where: { id: organizationId }, relations: { plan: true } });
    if (!org) throw new NotFoundException('Organization not found');

    const scope = { where: { organizationId } } as const;

    const [
      branches, users, items, suppliers, customers, stockLots,
      arrivals, sales, collections, supplierBills, supplierPayments,
      expenses, crateTransactions, adjustments, challans,
      bankAccounts, cashTransfers, itemPrices,
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
      this.dataSource.getRepository(BankAccount).find(scope),
      this.dataSource.getRepository(CashTransfer).find(scope),
      this.dataSource.getRepository(ItemPrice).find(scope),
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
      challans, challanLines, bankAccounts, cashTransfers, itemPrices,
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

  /**
   * Restore a previously-exported backup INTO the caller's own organization.
   *
   * Destructive & replace-style: all current masters and transactions for this
   * org are deleted and replaced with the file's contents, so anything created
   * after the backup is lost. The organization record and all USERS/logins are
   * intentionally left untouched (the backup carries no password hashes, so
   * wiping users would lock everyone out).
   *
   * Tenant-guarded: the file's organizationId must match the caller's org.
   */
  async restore(organizationId: string, file: BackupFile): Promise<{ restored: Record<string, number> }> {
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (file?.meta?.format !== 'mandi-erp-backup' || !file?.data) {
      throw new BadRequestException('Not a valid Mandi ERP backup file.');
    }
    if (file.meta.organizationId !== organizationId) {
      throw new BadRequestException(
        "This backup belongs to a different organization and can't be restored here.",
      );
    }

    const d = file.data;
    const restored: Record<string, number> = {};

    await this.dataSource.transaction(async (m) => {
      // 1) Wipe current data (children first to respect FK constraints).
      const saleIds = await this.idsFor(m, Sale, organizationId);
      const arrivalIds = await this.idsFor(m, Arrival, organizationId);
      const challanIds = await this.idsFor(m, Challan, organizationId);
      if (saleIds.length) await m.delete(SaleLine, { saleId: In(saleIds) });
      if (arrivalIds.length) await m.delete(ArrivalLine, { arrivalId: In(arrivalIds) });
      if (challanIds.length) await m.delete(ChallanLine, { challanId: In(challanIds) });

      for (const Entity of [
        Adjustment, Collection, SupplierPayment, SupplierBill, Expense,
        CrateTransaction, CashTransfer, Sale, Challan, StockLot, Arrival,
        ItemPrice, Item, Supplier, Customer, BankAccount, Branch,
      ]) {
        await m.delete(Entity, { organizationId });
      }

      // 2) Re-insert from the backup (parents first, lines last). Force the
      //    organizationId so the data always lands in the caller's tenant.
      restored.branches = await this.insertAll(m, Branch, d.branches, organizationId);
      restored.items = await this.insertAll(m, Item, d.items, organizationId);
      restored.suppliers = await this.insertAll(m, Supplier, d.suppliers, organizationId);
      restored.customers = await this.insertAll(m, Customer, d.customers, organizationId);
      restored.arrivals = await this.insertAll(m, Arrival, d.arrivals, organizationId);
      restored.stockLots = await this.insertAll(m, StockLot, d.stockLots, organizationId);
      restored.arrivalLines = await this.insertAll(m, ArrivalLine, d.arrivalLines, organizationId);
      restored.sales = await this.insertAll(m, Sale, d.sales, organizationId);
      restored.saleLines = await this.insertAll(m, SaleLine, d.saleLines, organizationId);
      restored.collections = await this.insertAll(m, Collection, d.collections, organizationId);
      restored.supplierBills = await this.insertAll(m, SupplierBill, d.supplierBills, organizationId);
      restored.supplierPayments = await this.insertAll(m, SupplierPayment, d.supplierPayments, organizationId);
      restored.expenses = await this.insertAll(m, Expense, d.expenses, organizationId);
      restored.crateTransactions = await this.insertAll(m, CrateTransaction, d.crateTransactions, organizationId);
      restored.adjustments = await this.insertAll(m, Adjustment, d.adjustments, organizationId);
      restored.challans = await this.insertAll(m, Challan, d.challans, organizationId);
      restored.challanLines = await this.insertAll(m, ChallanLine, d.challanLines, organizationId);
      restored.bankAccounts = await this.insertAll(m, BankAccount, d.bankAccounts, organizationId);
      restored.cashTransfers = await this.insertAll(m, CashTransfer, d.cashTransfers, organizationId);
      restored.itemPrices = await this.insertAll(m, ItemPrice, d.itemPrices, organizationId);
    });

    return { restored };
  }

  /**
   * Factory reset: permanently deletes ALL of the organization's business data —
   * masters and transactions — after re-verifying the admin's password. Kept:
   * the organization itself, branches, user accounts/logins, custom roles and
   * settings, so the team can sign back in to an empty company.
   *
   * The UI downloads a full backup BEFORE calling this; the endpoint itself is
   * a plain destructive wipe.
   */
  async reset(user: AuthUser, password: string): Promise<{ wiped: Record<string, number> }> {
    const organizationId = user.organizationId!;

    // Re-verify the caller's password — a stolen session must not be enough.
    const account = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id AND u.organization_id = :organizationId', { id: user.id, organizationId })
      .getOne();
    if (!(await verifySecret(password, account?.passwordHash))) {
      throw new ForbiddenException('Incorrect password — company data was NOT deleted.');
    }

    const wiped: Record<string, number> = {};
    await this.dataSource.transaction(async (m) => {
      // Children first (they carry no organizationId of their own).
      const saleIds = await this.idsFor(m, Sale, organizationId);
      const arrivalIds = await this.idsFor(m, Arrival, organizationId);
      const challanIds = await this.idsFor(m, Challan, organizationId);
      wiped.saleLines = saleIds.length ? (await m.delete(SaleLine, { saleId: In(saleIds) })).affected ?? 0 : 0;
      wiped.arrivalLines = arrivalIds.length ? (await m.delete(ArrivalLine, { arrivalId: In(arrivalIds) })).affected ?? 0 : 0;
      wiped.challanLines = challanIds.length ? (await m.delete(ChallanLine, { challanId: In(challanIds) })).affected ?? 0 : 0;

      // Transactions before the masters they reference; branches/users stay.
      const order: [string, EntityTarget<ObjectLiteral>][] = [
        ['adjustments', Adjustment], ['collections', Collection],
        ['supplierPayments', SupplierPayment], ['supplierBills', SupplierBill],
        ['expenses', Expense], ['crateTransactions', CrateTransaction],
        ['cashTransfers', CashTransfer], ['sales', Sale], ['challans', Challan],
        ['stockLots', StockLot], ['arrivals', Arrival],
        ['itemPrices', ItemPrice], ['items', Item],
        ['suppliers', Supplier], ['customers', Customer], ['bankAccounts', BankAccount],
      ];
      for (const [name, Entity] of order) {
        wiped[name] = (await m.delete(Entity, { organizationId })).affected ?? 0;
      }
    });
    return { wiped };
  }

  private async idsFor(
    m: EntityManager,
    Entity: EntityTarget<ObjectLiteral>,
    organizationId: string,
  ): Promise<string[]> {
    const rows = await m.find(Entity, { where: { organizationId } });
    return rows.map((r) => r.id as string);
  }

  /** Bulk-insert backup rows, forcing organizationId where the column exists. */
  private async insertAll(
    m: EntityManager,
    Entity: EntityTarget<ObjectLiteral>,
    rows: ObjectLiteral[] | undefined,
    organizationId: string,
  ): Promise<number> {
    if (!rows?.length) return 0;
    const prepared = rows.map((r) =>
      'organizationId' in r ? { ...r, organizationId } : r,
    );
    const chunk = 100; // keep each INSERT well under Postgres' parameter limit
    for (let i = 0; i < prepared.length; i += chunk) {
      await m.insert(Entity, prepared.slice(i, i + chunk));
    }
    return prepared.length;
  }
}

/** Shape of an uploaded backup file (mirrors export()). */
export interface BackupFile {
  meta?: { format?: string; organizationId?: string; organizationName?: string };
  data?: Record<string, ObjectLiteral[]>;
}
