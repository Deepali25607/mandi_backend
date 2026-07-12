import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { PaymentMode } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 15: built-in expense categories (seed the suggestion list). */
export enum ExpenseCategory {
  LABOUR = 'labour',
  TRANSPORT = 'transport',
  ELECTRICITY = 'electricity',
  RENT = 'rent',
  MISCELLANEOUS = 'miscellaneous',
}

/** Categories always offered as suggestions, even before any expense uses them. */
export const DEFAULT_EXPENSE_CATEGORIES: string[] = Object.values(ExpenseCategory);

@Entity('expenses')
@Index(['organizationId', 'branchId'])
@Index(['organizationId', 'expenseNumber'], { unique: true })
export class Expense extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'expense_number' })
  expenseNumber: string;

  @Column({ type: 'date' })
  date: string;

  // Free-text so users can create their own categories on the fly (not a fixed
  // enum). Stored lowercase/trimmed; the suggestion list is DEFAULT_EXPENSE_CATEGORIES
  // plus whatever categories the org has already used.
  @Column({ type: 'varchar', length: 60, default: ExpenseCategory.MISCELLANEOUS })
  category: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ name: 'payment_mode', type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  paymentMode: PaymentMode;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
