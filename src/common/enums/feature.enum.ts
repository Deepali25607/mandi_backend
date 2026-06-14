/**
 * Platform feature catalogue (SaaS feature flags).
 *
 * Each subscription plan enables a subset of these. Core day-to-day modules
 * (dashboard, sales, arrivals, inventory, collections, billing, masters, users,
 * organization) are always available and are NOT listed here — only the
 * optional/advanced modules that a plan can switch on or off.
 */
export enum PlatformFeature {
  SETTLEMENTS = 'settlements',
  EXPENSES = 'expenses',
  ACCOUNTING = 'accounting',
  CRATES = 'crates',
  CHALLANS = 'challans',
  ADJUSTMENTS = 'adjustments',
  REPORTS = 'reports',
}

/** All feature keys an admin can toggle on a plan. */
export const ALL_FEATURES: PlatformFeature[] = Object.values(PlatformFeature);

/** Human-readable catalogue used by the platform admin UI. */
export const FEATURE_CATALOGUE: { key: PlatformFeature; label: string; description: string }[] = [
  { key: PlatformFeature.SETTLEMENTS, label: 'Supplier Settlements', description: 'Generate supplier bills and record payments.' },
  { key: PlatformFeature.EXPENSES, label: 'Expenses', description: 'Record and track operating expenses.' },
  { key: PlatformFeature.ACCOUNTING, label: 'Accounting & Ledgers', description: 'Party ledgers, cash/bank book and trial balance.' },
  { key: PlatformFeature.CRATES, label: 'Crate Management', description: 'Track crate movement with customers and suppliers.' },
  { key: PlatformFeature.CHALLANS, label: 'For-Sale Challans', description: 'Transfer stock on challan, report and settle.' },
  { key: PlatformFeature.ADJUSTMENTS, label: 'Rate & Weight Adjustments', description: 'Record rate/weight differences against suppliers.' },
  { key: PlatformFeature.REPORTS, label: 'Reports', description: 'Sales, collection and stock registers.' },
];

/** Subscription lifecycle status for an organization. */
export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}
