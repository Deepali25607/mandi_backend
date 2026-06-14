import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { PaymentMode } from '@/common/enums/domain.enum';
import { Expense, ExpenseCategory } from './expense.entity';

interface CreateExpenseInput {
  date: string;
  category: ExpenseCategory;
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
    return this.repo.save(
      this.repo.create({
        organizationId,
        branchId: user.branchId!,
        expenseNumber: number,
        date: dto.date,
        category: dto.category,
        amount: dto.amount,
        paymentMode: dto.paymentMode ?? PaymentMode.CASH,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.repo.count({ where: { organizationId } });
    return `EXP-${String(count + 1).padStart(4, '0')}`;
  }
}
