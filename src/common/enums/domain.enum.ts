/** Item categories per BRD Module 2 (Item Master). */
export enum ItemCategory {
  VEGETABLES = 'vegetables',
  FRUITS = 'fruits',
  FLOWERS = 'flowers',
  GROCERY = 'grocery',
}

/** How a supplier's commission is charged. */
export enum CommissionType {
  PERCENTAGE = 'percentage',
  FIXED_PER_KG = 'fixed_per_kg',
}

/** Billing / payment methods per BRD Module 7. */
export enum PaymentMode {
  CASH = 'cash',
  CREDIT = 'credit',
  UPI = 'upi',
  BANK = 'bank',
}

/** Modes whose money lands in a bank account (not Cash in Hand). */
export const BANK_LINKED_MODES: PaymentMode[] = [PaymentMode.UPI, PaymentMode.BANK];

export function isBankLinkedMode(mode: PaymentMode): boolean {
  return BANK_LINKED_MODES.includes(mode);
}

/** Lifecycle of an inventory lot. */
export enum LotStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

/** Direction of an internal cash ↔ bank fund transfer (contra entry). */
export enum TransferDirection {
  /** Deposit: money moves from Cash in Hand into a bank account. */
  CASH_TO_BANK = 'cash_to_bank',
  /** Withdrawal: money moves from a bank account into Cash in Hand. */
  BANK_TO_CASH = 'bank_to_cash',
}
