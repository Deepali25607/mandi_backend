/**
 * User roles as defined in the BRD (Section 5: User Roles).
 * The string values are stored in the DB and used in JWT claims.
 */
export enum Role {
  SUPER_ADMIN = 'super_admin', // Complete platform access
  ORG_ADMIN = 'org_admin', // Organization management
  ACCOUNTANT = 'accountant', // Accounting & billing
  SALES_OPERATOR = 'sales_operator', // Sales entry
  INVENTORY_MANAGER = 'inventory_manager', // Stock management
  COLLECTION_EXECUTIVE = 'collection_executive', // Ugrahi collection
  PURCHASE_OPERATOR = 'purchase_operator', // Arrival entry
  AUDITOR = 'auditor', // Reports only
}

/** Human-readable labels for UI / display. */
export const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Admin',
  [Role.ORG_ADMIN]: 'Organization Admin',
  [Role.ACCOUNTANT]: 'Accountant',
  [Role.SALES_OPERATOR]: 'Sales Operator',
  [Role.INVENTORY_MANAGER]: 'Inventory Manager',
  [Role.COLLECTION_EXECUTIVE]: 'Collection Executive',
  [Role.PURCHASE_OPERATOR]: 'Purchase Operator',
  [Role.AUDITOR]: 'Auditor',
};
