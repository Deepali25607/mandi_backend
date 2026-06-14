import { AppDataSource } from './data-source';
import { Organization } from '@/modules/organizations/organization.entity';
import { Branch } from '@/modules/branches/branch.entity';
import { User } from '@/modules/users/user.entity';
import { Item } from '@/modules/items/item.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { Customer } from '@/modules/customers/customer.entity';
import { SubscriptionPlan } from '@/modules/platform/subscription-plan.entity';
import { Role } from '@/common/enums/role.enum';
import { CommissionType, ItemCategory } from '@/common/enums/domain.enum';
import {
  BillingCycle,
  PlatformFeature,
  SubscriptionStatus,
} from '@/common/enums/feature.enum';
import { hashSecret, normalizeAnswer } from '@/common/utils/password.util';

/**
 * Seeds a demo tenant with one user per BRD role.
 * Idempotent: re-running updates existing records (matched by username).
 *
 * Login in dev: POST /api/auth/login { username, password }.
 * All demo users share password "Mandi@123".
 */
async function seed() {
  await AppDataSource.initialize();
  const orgRepo = AppDataSource.getRepository(Organization);
  const branchRepo = AppDataSource.getRepository(Branch);
  const userRepo = AppDataSource.getRepository(User);
  const planRepo = AppDataSource.getRepository(SubscriptionPlan);

  // --- Subscription plans (platform-level pricing tiers) ---
  const planDefs = [
    {
      name: 'Starter', code: 'starter', description: 'For a single mandi getting started — core trading only.',
      priceMonthly: 0, priceYearly: 0, maxUsers: 3, maxBranches: 1,
      features: [PlatformFeature.EXPENSES, PlatformFeature.REPORTS],
      isDefault: true, isPublic: true, isActive: true, sortOrder: 1,
    },
    {
      name: 'Standard', code: 'standard', description: 'Growing arhat with settlements, crates and reports.',
      priceMonthly: 999, priceYearly: 9990, maxUsers: 10, maxBranches: 3,
      features: [
        PlatformFeature.EXPENSES, PlatformFeature.REPORTS, PlatformFeature.SETTLEMENTS,
        PlatformFeature.CRATES,
      ],
      isDefault: false, isPublic: true, isActive: true, sortOrder: 2,
    },
    {
      name: 'Premium', code: 'premium', description: 'Full ERP — every module including accounting and challans.',
      priceMonthly: 2499, priceYearly: 24990, maxUsers: null, maxBranches: null,
      features: [
        PlatformFeature.EXPENSES, PlatformFeature.REPORTS, PlatformFeature.SETTLEMENTS,
        PlatformFeature.CRATES, PlatformFeature.ACCOUNTING, PlatformFeature.CHALLANS,
        PlatformFeature.ADJUSTMENTS,
      ],
      isDefault: false, isPublic: true, isActive: true, sortOrder: 3,
    },
  ];
  const plans: Record<string, SubscriptionPlan> = {};
  for (const def of planDefs) {
    const existing = await planRepo.findOne({ where: { code: def.code } });
    plans[def.code] = existing
      ? await planRepo.save(planRepo.merge(existing, def))
      : await planRepo.save(planRepo.create(def));
  }

  // --- Organization (subscribed to Premium for the full-feature demo) ---
  let org = await orgRepo.findOne({ where: { name: 'Shree Balaji Trading Co.' } });
  const orgData = {
    name: 'Shree Balaji Trading Co.',
    gstNumber: '07ABCDE1234F1Z5',
    address: 'Azadpur Mandi, Block C, New Delhi',
    mobile: '9810000000',
    email: 'office@balajitrading.in',
    planId: plans.premium.id,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    subscriptionStart: '2026-01-01',
    renewalDate: '2026-12-31',
  };
  if (!org) {
    org = await orgRepo.save(orgRepo.create(orgData));
  } else {
    org = await orgRepo.save(orgRepo.merge(org, orgData));
  }

  // --- Branches ---
  const branchDefs = [
    { name: 'Azadpur Main', location: 'Azadpur, Delhi', contactDetails: '011-2700-0000' },
    { name: 'Ghazipur Branch', location: 'Ghazipur, Delhi', contactDetails: '011-2200-0000' },
  ];
  const branches: Branch[] = [];
  for (const def of branchDefs) {
    let branch = await branchRepo.findOne({
      where: { organizationId: org.id, name: def.name },
    });
    if (!branch) {
      branch = await branchRepo.save(
        branchRepo.create({ ...def, organizationId: org.id }),
      );
    }
    branches.push(branch);
  }
  const mainBranch = branches[0];

  // --- Users: one per role (username + password login) ---
  // All demo users share password "Mandi@123". The org admin has a security
  // question set so the recovery flow is demoable.
  const passwordHash = await hashSecret('Mandi@123');
  const securityAnswerHash = await hashSecret(normalizeAnswer('Delhi'));

  const userDefs: Array<{ name: string; username: string; mobile: string; role: Role; org: boolean }> = [
    { name: 'Platform Owner', username: 'owner', mobile: '9000000000', role: Role.SUPER_ADMIN, org: false },
    { name: 'Rajesh Agarwal', username: 'admin', mobile: '9000000001', role: Role.ORG_ADMIN, org: true },
    { name: 'Sunita Accountant', username: 'accountant', mobile: '9000000002', role: Role.ACCOUNTANT, org: true },
    { name: 'Vikram Sales', username: 'sales', mobile: '9000000003', role: Role.SALES_OPERATOR, org: true },
    { name: 'Imran Stock', username: 'inventory', mobile: '9000000004', role: Role.INVENTORY_MANAGER, org: true },
    { name: 'Deepak Ugrahi', username: 'collection', mobile: '9000000005', role: Role.COLLECTION_EXECUTIVE, org: true },
    { name: 'Anil Purchase', username: 'purchase', mobile: '9000000006', role: Role.PURCHASE_OPERATOR, org: true },
    { name: 'Meera Auditor', username: 'auditor', mobile: '9000000007', role: Role.AUDITOR, org: true },
  ];

  for (const def of userDefs) {
    const existing = await userRepo.findOne({ where: { username: def.username } });
    const data = {
      name: def.name,
      username: def.username,
      mobile: def.mobile,
      role: def.role,
      organizationId: def.org ? org.id : null,
      branchId: def.org ? mainBranch.id : null,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      // Give the org admin a recovery question (answer: "Delhi").
      ...(def.username === 'admin'
        ? { securityQuestion: 'Which city is your mandi in?', securityAnswerHash }
        : {}),
    };
    if (existing) {
      await userRepo.update(existing.id, data);
    } else {
      await userRepo.save(userRepo.create(data));
    }
  }

  // --- Master data: Items ---
  const itemRepo = AppDataSource.getRepository(Item);
  const itemDefs = [
    { code: 'ITM-0001', name: 'Tomato', category: ItemCategory.VEGETABLES, commission: 6, fee: 1 },
    { code: 'ITM-0002', name: 'Onion', category: ItemCategory.VEGETABLES, commission: 6, fee: 1 },
    { code: 'ITM-0003', name: 'Potato', category: ItemCategory.VEGETABLES, commission: 5, fee: 1 },
    { code: 'ITM-0004', name: 'Cauliflower', category: ItemCategory.VEGETABLES, commission: 7, fee: 1 },
    { code: 'ITM-0005', name: 'Apple', category: ItemCategory.FRUITS, commission: 8, fee: 1.5 },
    { code: 'ITM-0006', name: 'Banana', category: ItemCategory.FRUITS, commission: 7, fee: 1.5 },
    { code: 'ITM-0007', name: 'Marigold', category: ItemCategory.FLOWERS, commission: 10, fee: 2 },
  ];
  for (const def of itemDefs) {
    const existing = await itemRepo.findOne({ where: { organizationId: org.id, code: def.code } });
    const data = {
      organizationId: org.id,
      code: def.code,
      name: def.name,
      category: def.category,
      unit: 'kg',
      defaultCommissionPct: def.commission,
      defaultMarketFeePct: def.fee,
      isActive: true,
    };
    if (existing) await itemRepo.update(existing.id, data);
    else await itemRepo.save(itemRepo.create(data));
  }

  // --- Master data: Suppliers ---
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const supplierDefs = [
    { code: 'SUP-0001', name: 'Ramesh Farms', village: 'Sonipat', mobile: '9811100001', rate: 6 },
    { code: 'SUP-0002', name: 'Patil Bagh', village: 'Nashik', mobile: '9811100002', rate: 7 },
    { code: 'SUP-0003', name: 'Singh Mandi Supply', village: 'Karnal', mobile: '9811100003', rate: 6 },
    { code: 'SUP-0004', name: 'Kisan Co-op', village: 'Panipat', mobile: '9811100004', rate: 5 },
  ];
  for (const def of supplierDefs) {
    const existing = await supplierRepo.findOne({ where: { organizationId: org.id, code: def.code } });
    const data = {
      organizationId: org.id,
      code: def.code,
      name: def.name,
      village: def.village,
      mobile: def.mobile,
      commissionType: CommissionType.PERCENTAGE,
      commissionRate: def.rate,
      isActive: true,
    };
    if (existing) await supplierRepo.update(existing.id, data);
    else await supplierRepo.save(supplierRepo.create(data));
  }

  // --- Master data: Customers ---
  const customerRepo = AppDataSource.getRepository(Customer);
  const customerDefs = [
    { code: 'CUST-0001', name: 'Sharma Traders', area: 'Sadar Bazar', mobile: '9822200001', credit: 200000 },
    { code: 'CUST-0002', name: 'Gupta Stores', area: 'Karol Bagh', mobile: '9822200002', credit: 150000 },
    { code: 'CUST-0003', name: 'Verma & Sons', area: 'Chandni Chowk', mobile: '9822200003', credit: 300000 },
    { code: 'CUST-0004', name: 'Krishna Veg', area: 'Lajpat Nagar', mobile: '9822200004', credit: 100000 },
    { code: 'CUST-0005', name: 'Mehta Mart', area: 'Rohini', mobile: '9822200005', credit: 250000 },
  ];
  for (const def of customerDefs) {
    const existing = await customerRepo.findOne({ where: { organizationId: org.id, code: def.code } });
    const data = {
      organizationId: org.id,
      code: def.code,
      name: def.name,
      area: def.area,
      mobile: def.mobile,
      creditLimit: def.credit,
      isActive: true,
    };
    if (existing) await customerRepo.update(existing.id, data);
    else await customerRepo.save(customerRepo.create(data));
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${itemDefs.length} items, ${supplierDefs.length} suppliers, ${customerDefs.length} customers.`);

  // eslint-disable-next-line no-console
  console.log('\n✅ Seed complete.\n');
  // eslint-disable-next-line no-console
  console.log(`Organization: ${org.name} (${org.id})`);
  // eslint-disable-next-line no-console
  console.log(`Branches: ${branches.map((b) => b.name).join(', ')}`);
  // eslint-disable-next-line no-console
  console.log('\nLogin with username + password "Mandi@123":');
  for (const d of userDefs) {
    // eslint-disable-next-line no-console
    console.log(`  ${d.username.padEnd(12)} ->  ${d.name} (${d.role})`);
  }
  console.log('\nRecovery demo: username "admin", question answer "Delhi".');
  console.log('');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
