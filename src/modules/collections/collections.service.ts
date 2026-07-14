import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { PaymentMode, isBankLinkedMode } from '@/common/enums/domain.enum';
import { BankAccountsService } from '@/modules/bank-accounts/bank-accounts.service';
import { Collection } from './collection.entity';

interface CreateCollectionInput {
  date: string;
  customerId: string;
  amount: number;
  paymentMode?: PaymentMode;
  bankAccountId?: string | null;
  charges?: number;
  reference?: string;
  notes?: string;
}

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection) private readonly repo: Repository<Collection>,
    private readonly bankAccounts: BankAccountsService,
  ) {}

  list(
    organizationId: string,
    branchId: string,
    filters: { customerId?: string; from?: string; to?: string } = {},
  ): Promise<Collection[]> {
    const where: FindOptionsWhere<Collection> = { organizationId, branchId };
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.from && filters.to) where.date = Between(filters.from, filters.to);
    return this.repo.find({ where, order: { date: 'DESC', createdAt: 'DESC' }, take: 200 });
  }

  async create(user: AuthUser, dto: CreateCollectionInput): Promise<Collection> {
    const organizationId = user.organizationId!;
    const mode = dto.paymentMode ?? PaymentMode.CASH;
    const bankLinked = isBankLinkedMode(mode);

    // Charges and a bank account only make sense for bank-linked receipts.
    let bankAccountId: string | null = null;
    let charges = 0;
    if (bankLinked) {
      charges = dto.charges ?? 0;
      if (charges < 0) throw new BadRequestException('Charges cannot be negative.');
      if (charges >= dto.amount) throw new BadRequestException('Charges must be less than the amount received.');
      if (dto.bankAccountId) {
        await this.bankAccounts.assertUsable(organizationId, dto.bankAccountId);
        bankAccountId = dto.bankAccountId;
      }
    }

    const number = await this.nextNumber(organizationId);
    return this.repo.save(
      this.repo.create({
        organizationId,
        branchId: user.branchId!,
        collectionNumber: number,
        date: dto.date,
        customerId: dto.customerId,
        amount: dto.amount,
        paymentMode: mode,
        bankAccountId,
        charges,
        reference: dto.reference,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
  }

  /** Total collected per customer (for outstanding calc). */
  async totalsByCustomer(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.customer_id', 'customerId')
      .addSelect('SUM(c.amount)', 'total')
      .where('c.organization_id = :organizationId', { organizationId })
      .groupBy('c.customer_id')
      .getRawMany<{ customerId: string; total: string }>();
    return new Map(rows.map((r) => [r.customerId, parseFloat(r.total)]));
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.repo.count({ where: { organizationId } });
    return `COL-${String(count + 1).padStart(4, '0')}`;
  }
}
