import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { Customer } from '@/modules/customers/customer.entity';
import { Supplier } from '@/modules/suppliers/supplier.entity';
import { CrateDirection, CrateParty, CrateTransaction } from './crate-transaction.entity';

interface CreateCrateInput {
  date: string;
  partyType: CrateParty;
  partyId: string;
  direction: CrateDirection;
  quantity: number;
  damaged?: number;
  notes?: string;
}

export interface CrateBalanceRow {
  partyType: CrateParty;
  partyId: string;
  name: string;
  out: number;
  in: number;
  damaged: number;
  balance: number; // crates currently held by the party (customer) / by us (supplier)
}

@Injectable()
export class CratesService {
  constructor(
    @InjectRepository(CrateTransaction) private readonly repo: Repository<CrateTransaction>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
  ) {}

  list(organizationId: string, branchId: string): Promise<CrateTransaction[]> {
    return this.repo.find({ where: { organizationId, branchId }, order: { date: 'DESC', createdAt: 'DESC' }, take: 200 });
  }

  create(user: AuthUser, dto: CreateCrateInput): Promise<CrateTransaction> {
    return this.repo.save(
      this.repo.create({
        organizationId: user.organizationId!,
        branchId: user.branchId!,
        date: dto.date,
        partyType: dto.partyType,
        partyId: dto.partyId,
        direction: dto.direction,
        quantity: dto.quantity,
        damaged: dto.damaged ?? 0,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
  }

  async balances(organizationId: string): Promise<CrateBalanceRow[]> {
    const txns = await this.repo.find({ where: { organizationId } });
    const [customers, suppliers] = await Promise.all([
      this.customers.find({ where: { organizationId } }),
      this.suppliers.find({ where: { organizationId } }),
    ]);
    const names = new Map<string, string>();
    customers.forEach((c) => names.set(`customer:${c.id}`, c.name));
    suppliers.forEach((s) => names.set(`supplier:${s.id}`, s.name));

    const map = new Map<string, CrateBalanceRow>();
    for (const t of txns) {
      const key = `${t.partyType}:${t.partyId}`;
      let row = map.get(key);
      if (!row) {
        row = { partyType: t.partyType, partyId: t.partyId, name: names.get(key) ?? 'Unknown', out: 0, in: 0, damaged: 0, balance: 0 };
        map.set(key, row);
      }
      if (t.direction === CrateDirection.OUT) row.out += t.quantity;
      else row.in += t.quantity;
      row.damaged += t.damaged;
    }
    for (const row of map.values()) {
      // Customer holds crates we issued (out − in). For suppliers we hold their
      // crates received (in − out). Damaged crates are written off the balance.
      row.balance =
        row.partyType === CrateParty.CUSTOMER
          ? row.out - row.in - row.damaged
          : row.in - row.out - row.damaged;
    }
    return [...map.values()].filter((r) => r.out || r.in || r.damaged).sort((a, b) => b.balance - a.balance);
  }
}
