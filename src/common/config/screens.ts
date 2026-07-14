import { PlatformFeature } from '@/common/enums/feature.enum';
import { Role } from '@/common/enums/role.enum';

/**
 * Catalogue of the org-level screens an Org Admin can grant to a custom role.
 *
 * This mirrors the frontend nav config (src/components/layout/navConfig.tsx) but
 * only lists the operational / masters / accounts / reports screens — platform
 * and admin-only screens are intentionally excluded (a custom staff role can
 * never be granted Users, Organization, Backup, etc.).
 *
 * `capabilities` are the built-in operational roles whose write permissions the
 * screen needs. Reads are open to any authenticated tenant user, so only write
 * endpoints are role-gated; granting a screen therefore grants the minimal
 * capability required to *use* that screen. The backend enforces at this
 * (module/capability) granularity; the frontend hides everything not granted.
 */
export interface ScreenDef {
  path: string;
  label: string;
  section: 'Operations' | 'Masters' | 'Accounts' | 'Reports';
  /** Built-in roles whose write access this screen requires (empty = open reads only). */
  capabilities: Role[];
  /** Subscription feature this screen belongs to (still enforced by FeatureGuard). */
  feature?: PlatformFeature;
  /** Always available to every user; not an admin-toggleable checkbox. */
  always?: boolean;
}

export const ASSIGNABLE_SCREENS: ScreenDef[] = [
  // Operations
  { path: '/dashboard', label: 'Dashboard', section: 'Operations', capabilities: [], always: true },
  { path: '/sales', label: 'Sale Entry', section: 'Operations', capabilities: [Role.SALES_OPERATOR] },
  { path: '/arrivals', label: 'Arrival Entry', section: 'Operations', capabilities: [Role.PURCHASE_OPERATOR] },
  { path: '/collections', label: 'Collections', section: 'Operations', capabilities: [Role.COLLECTION_EXECUTIVE] },
  { path: '/inventory', label: 'Inventory', section: 'Operations', capabilities: [Role.INVENTORY_MANAGER] },
  { path: '/challans', label: 'For-Sale Challan', section: 'Operations', capabilities: [Role.INVENTORY_MANAGER], feature: PlatformFeature.CHALLANS },
  { path: '/crates', label: 'Crates', section: 'Operations', capabilities: [Role.INVENTORY_MANAGER], feature: PlatformFeature.CRATES },

  // Masters
  { path: '/suppliers', label: 'Suppliers', section: 'Masters', capabilities: [Role.PURCHASE_OPERATOR] },
  { path: '/customers', label: 'Customers', section: 'Masters', capabilities: [Role.SALES_OPERATOR] },
  { path: '/items', label: 'Items', section: 'Masters', capabilities: [Role.INVENTORY_MANAGER] },

  // Accounts
  { path: '/billing', label: 'Billing', section: 'Accounts', capabilities: [Role.SALES_OPERATOR] },
  { path: '/settlements', label: 'Settlements', section: 'Accounts', capabilities: [Role.ACCOUNTANT], feature: PlatformFeature.SETTLEMENTS },
  { path: '/outstanding', label: 'Outstanding', section: 'Accounts', capabilities: [] },
  { path: '/bank-accounts', label: 'Bank Accounts', section: 'Accounts', capabilities: [Role.ACCOUNTANT] },
  { path: '/adjustments', label: 'Adjustments', section: 'Accounts', capabilities: [Role.ACCOUNTANT], feature: PlatformFeature.ADJUSTMENTS },
  { path: '/expenses', label: 'Expenses', section: 'Accounts', capabilities: [Role.ACCOUNTANT], feature: PlatformFeature.EXPENSES },
  { path: '/accounting', label: 'Accounting', section: 'Accounts', capabilities: [Role.AUDITOR], feature: PlatformFeature.ACCOUNTING },

  // Reports
  { path: '/reports', label: 'Reports', section: 'Reports', capabilities: [Role.AUDITOR], feature: PlatformFeature.REPORTS },
];

const SCREEN_BY_PATH = new Map(ASSIGNABLE_SCREENS.map((s) => [s.path, s]));

/** All valid screen paths an admin may put on a custom role (includes always-on ones). */
export const ASSIGNABLE_SCREEN_PATHS: string[] = ASSIGNABLE_SCREENS.map((s) => s.path);

/** Screens that are always granted regardless of the custom-role selection. */
export const ALWAYS_SCREEN_PATHS: string[] = ASSIGNABLE_SCREENS.filter((s) => s.always).map((s) => s.path);

/** Keep only known screen paths (drops anything not in the catalogue). */
export function sanitizeScreens(paths: string[]): string[] {
  const seen = new Set<string>();
  for (const p of paths) if (SCREEN_BY_PATH.has(p)) seen.add(p);
  for (const p of ALWAYS_SCREEN_PATHS) seen.add(p);
  return ASSIGNABLE_SCREEN_PATHS.filter((p) => seen.has(p));
}

/** Union of capability roles required by the given granted screens. */
export function capabilitiesForScreens(paths: string[]): Role[] {
  const caps = new Set<Role>();
  for (const p of paths) {
    const screen = SCREEN_BY_PATH.get(p);
    if (screen) for (const c of screen.capabilities) caps.add(c);
  }
  return [...caps];
}
