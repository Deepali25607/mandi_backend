import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { PaymentMode } from '@/common/enums/domain.enum';
import { NumericTransformer } from '@/common/transformers/numeric.transformer';

/** BRD Module 15: Expense categories. */
export enum ExpenseCategory {
  LABOUR = 'labour',
  TRANSPORT = 'transport',
  ELECTRICITY = 'electricity',
  RENT = 'rent',
  MISCELLANEOUS = 'miscellaneous',
}

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

  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.MISCELLANEOUS })
  category: ExpenseCategory;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: NumericTransformer })
  amount: number;

  @Column({ name: 'payment_mode', type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  paymentMode: PaymentMode;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;
}
