import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { PaymentMode } from '@/common/enums/domain.enum';
import { DEFAULT_EXPENSE_CATEGORIES, Expense, ExpenseCategory } from './expense.entity';

interface CreateExpenseInput {
  date: string;
  category: string;
  amount: number;
  paymentMode?: PaymentMode;
  notes?: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly repo: Repository<Expense>,
  ) {}

  list(
    organizationId: string,
    branchId: string,
    filters: { from?: string; to?: string } = {},
  ): Promise<Expense[]> {
    const where: FindOptionsWhere<Expense> = { organizationId, branchId };
    if (filters.from && filters.to) where.date = Between(filters.from, filters.to);
    return this.repo.find({ where, order: { date: 'DESC', createdAt: 'DESC' }, take: 200 });
  }

  async create(user: AuthUser, dto: CreateExpenseInput): Promise<Expense> {
    const organizationId = user.organizationId!;
    const number = await this.nextNumber(organizationId);
    const category = (dto.category?.trim() || ExpenseCategory.MISCELLANEOUS).toLowerCase();
    return this.repo.save(
      this.repo.create({
        organizationId,
        branchId: user.branchId!,
        expenseNumber: number,
        date: dto.date,
        category,
        amount: dto.amount,
        paymentMode: dto.paymentMode ?? PaymentMode.CASH,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
  }

  /** Category suggestions: built-in defaults + every category this org has used. */
  async listCategories(organizationId: string): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('DISTINCT e.category', 'category')
      .where('e.organization_id = :organizationId', { organizationId })
      .getRawMany<{ category: string }>();
    const used = rows.map((r) => r.category).filter(Boolean);
    // Case-insensitive dedupe, keeping first-seen spelling, sorted alphabetically.
    const seen = new Map<string, string>();
    for (const c of [...DEFAULT_EXPENSE_CATEGORIES, ...used]) {
      const key = c.toLowerCase();
      if (!seen.has(key)) seen.set(key, key);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.repo.count({ where: { organizationId } });
    return `EXP-${String(count + 1).padStart(4, '0')}`;
  }
}
