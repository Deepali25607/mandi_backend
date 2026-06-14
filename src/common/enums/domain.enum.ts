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

/** Lifecycle of an inventory lot. */
export enum LotStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}
