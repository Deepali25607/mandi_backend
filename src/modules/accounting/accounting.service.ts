import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMode } from '@/common/enums/domain.enum';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Sale } from '@/modules/sales/sale.entity';
import { Collection } from '@/modules/collections/collection.entity';
import { SupplierBill } from '@/modules/settlements/supplier-bill.entity';
import { SupplierPayment } from '@/modules/settlements/supplier-payment.entity';
import { Expense } from '@/modules/expenses/expense.entity';
import { AdjustmentsService } from '@/modules/adjustments/adjustments.service';

export interface LedgerRow {
  date: string;
  voucher: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface CashBookRow {
  date: string;
  voucher: string;
  particulars: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface TrialBalanceRow {
  account: string;
  debit: number;
  credit: number;
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    @InjectRepository(Collection) private readonly collections: Repository<Collection>,
    @InjectRepository(SupplierBill) private readonly bills: Repository<SupplierBill>,
    @InjectRepository(SupplierPayment) private readonly payments: Repository<SupplierPayment>,
    @InjectRepository(Expense) private readonly expenses: Repository<Expense>,
    private readonly adjustmentsService: AdjustmentsService,
  ) {}

  /** Customer ledger: sales add to receivable (debit), collections reduce it (credit). */
  async customerLedger(organizationId: string, customerId: string): Promise<{ name: string; rows: LedgerRow[]; balance: number }> {
    const customer = await this.customers.findOne({ where: { id: customerId, organizationId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const [sales, receipts] = await Promise.all([
      this.sales.find({ where: { organizationId, customerId }, order: { date: 'ASC' } }),
      this.collections.find({ where: { organizationId, customerId }, order: { date: 'ASC' } }),
    ]);

    const entries: Omit<LedgerRow, 'balance'>[] = [
      ...sales.map((s) => ({ date: s.date, voucher: s.saleNumber, particulars: 'Sale', debit: s.grossAmount, credit: 0 })),
      ...receipts.map((r) => ({ date: r.date, voucher: r.collectionNumber, particulars: `Receipt (${r.paymentMode})`, debit: 0, credit: r.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let balance = customer.openingBalance ?? 0;
    const rows: LedgerRow[] = [{ date: '—', voucher: '', particulars: 'Opening balance', debit: 0, credit: 0, balance: round2(balance) }];
    for (const e of entries) {
      balance += e.debit - e.credit;
      rows.push({ ...e, debit: round2(e.debit), credit: round2(e.credit), balance: round2(balance) });
    }
    return { name: customer.name, rows, balance: round2(balance) };
  }

  /** Supplier ledger: bills add to payable (credit), payments reduce it (debit). */
  async supplierLedger(organizationId: string, supplierId: string): Promise<{ name: string; rows: LedgerRow[]; balance: number }> {
    const supplier = await this.suppliers.findOne({ where: { id: supplierId, organizationId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const [bills, pays, adjustments] = await Promise.all([
      this.bills.find({ where: { organizationId, supplierId }, order: { date: 'ASC' } }),
      this.payments.find({ where: { organizationId, supplierId }, order: { date: 'ASC' } }),
      this.adjustmentsService.listBySupplier(organizationId, supplierId),
    ]);

    const entries: Omit<LedgerRow, 'balance'>[] = [
      ...bills.map((b) => ({ date: b.date, voucher: b.billNumber, particulars: 'Settlement bill (net payable)', debit: 0, credit: b.netPayable })),
      ...pays.map((p) => ({ date: p.date, voucher: p.paymentNumber, particulars: `Payment (${p.paymentMode})`, debit: p.amount, credit: 0 })),
      // Rate/weight adjustments: +amount increases payable (credit), −amount debit.
      ...adjustments.map((a) => ({
        date: a.date,
        voucher: a.adjustmentNumber,
        particulars: `Adjustment (${a.type.replace('_', ' ')})`,
        debit: a.amount < 0 ? Math.abs(a.amount) : 0,
        credit: a.amount > 0 ? a.amount : 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let balance = supplier.openingBalance ?? 0;
    const rows: LedgerRow[] = [{ date: '—', voucher: '', particulars: 'Opening balance', debit: 0, credit: 0, balance: round2(balance) }];
    for (const e of entries) {
      balance += e.credit - e.debit; // payable grows on credit
      rows.push({ ...e, debit: round2(e.debit), credit: round2(e.credit), balance: round2(balance) });
    }
    return { name: supplier.name, rows, balance: round2(balance) };
  }

  /** Cash or bank book from collections (in), supplier payments (out) and expenses (out). */
  async cashBook(organizationId: string, kind: 'cash' | 'bank'): Promise<{ rows: CashBookRow[]; balance: number }> {
    const modes: PaymentMode[] = kind === 'cash' ? [PaymentMode.CASH] : [PaymentMode.BANK, PaymentMode.UPI];
    const [receipts, pays, exps] = await Promise.all([
      this.collections.find({ where: { organizationId }, order: { date: 'ASC' } }),
      this.payments.find({ where: { organizationId }, order: { date: 'ASC' } }),
      this.expenses.find({ where: { organizationId }, order: { date: 'ASC' } }),
    ]);
    const inMode = (m: PaymentMode) => modes.includes(m);

    const entries: Omit<CashBookRow, 'balance'>[] = [
      ...receipts.filter((r) => inMode(r.paymentMode)).map((r) => ({ date: r.date, voucher: r.collectionNumber, particulars: 'Collection received', inflow: r.amount, outflow: 0 })),
      ...pays.filter((p) => inMode(p.paymentMode)).map((p) => ({ date: p.date, voucher: p.paymentNumber, particulars: 'Supplier payment', inflow: 0, outflow: p.amount })),
      ...exps.filter((e) => inMode(e.paymentMode)).map((e) => ({ date: e.date, voucher: e.expenseNumber, particulars: `Expense (${e.category})`, inflow: 0, outflow: e.amount })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let balance = 0;
    const rows: CashBookRow[] = entries.map((e) => {
      balance += e.inflow - e.outflow;
      return { ...e, inflow: round2(e.inflow), outflow: round2(e.outflow), balance: round2(balance) };
    });
    return { rows, balance: round2(balance) };
  }

  /**
   * Simplified trial balance (summary, not a strict double-entry GL — see
   * IMPLEMENTATION_LOG). Shows the main account heads and their net position.
   */
  async trialBalance(organizationId: string): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> {
    const [customers, suppliers, sales, receipts, pays, exps, bills] = await Promise.all([
      this.customers.find({ where: { organizationId } }),
      this.suppliers.find({ where: { organizationId } }),
      this.sales.find({ where: { organizationId } }),
      this.collections.find({ where: { organizationId } }),
      this.payments.find({ where: { organizationId } }),
      this.expenses.find({ where: { organizationId } }),
      this.bills.find({ where: { organizationId } }),
    ]);

    const sum = (arr: { amount?: number; grossAmount?: number; netPayable?: number }[], key: 'amount' | 'grossAmount' | 'netPayable') =>
      arr.reduce((s, x) => s + ((x as Record<string, number>)[key] ?? 0), 0);

    const salesGross = sales.reduce((s, x) => s + x.grossAmount, 0);
    const commissionIncome = sales.reduce((s, x) => s + x.commissionAmount, 0);
    const marketFeeCollected = sales.reduce((s, x) => s + x.marketFeeAmount, 0);
    const totalReceipts = sum(receipts, 'amount');
    const totalPayments = sum(pays, 'amount');
    const totalExpenses = sum(exps, 'amount');
    const billNet = sum(bills, 'netPayable');

    const openingDebtors = customers.reduce((s, c) => s + (c.openingBalance ?? 0), 0);
    const openingCreditors = suppliers.reduce((s, x) => s + (x.openingBalance ?? 0), 0);

    const debtors = round2(openingDebtors + salesGross - totalReceipts); // receivable
    const creditors = round2(openingCreditors + billNet - totalPayments); // payable
    const cashBank = round2(totalReceipts - totalPayments - totalExpenses);

    const rows: TrialBalanceRow[] = [
      { account: 'Sundry Debtors (Receivable)', debit: Math.max(0, debtors), credit: Math.max(0, -debtors) },
      { account: 'Cash & Bank', debit: Math.max(0, cashBank), credit: Math.max(0, -cashBank) },
      { account: 'Expenses', debit: round2(totalExpenses), credit: 0 },
      { account: 'Sundry Creditors (Payable)', debit: Math.max(0, -creditors), credit: Math.max(0, creditors) },
      { account: 'Commission Income', debit: 0, credit: round2(commissionIncome) },
      { account: 'Market Fee Collected', debit: 0, credit: round2(marketFeeCollected) },
      { account: 'Sales (Gross)', debit: 0, credit: round2(salesGross) },
      { account: 'Sales contra (paid to suppliers/in stock)', debit: round2(salesGross - commissionIncome - marketFeeCollected), credit: 0 },
    ];
    const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
    const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
    return { rows, totalDebit, totalCredit };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
