import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { TransferDirection } from '@/common/enums/domain.enum';
import { BankAccountsService } from '@/modules/bank-accounts/bank-accounts.service';
import { CashTransfer } from './cash-transfer.entity';

interface CreateCashTransferInput {
  date: string;
  direction: TransferDirection;
  bankAccountId: string;
  amount: number;
  notes?: string;
}

@Injectable()
export class CashTransfersService {
  constructor(
    @InjectRepository(CashTransfer) private readonly repo: Repository<CashTransfer>,
    private readonly bankAccounts: BankAccountsService,
  ) {}

  list(organizationId: string, branchId: string): Promise<CashTransfer[]> {
    return this.repo.find({
      where: { organizationId, branchId },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
  }

  async create(user: AuthUser, dto: CreateCashTransferInput): Promise<CashTransfer> {
    const organizationId = user.organizationId!;
    // The bank account must belong to the org and be active.
    await this.bankAccounts.assertUsable(organizationId, dto.bankAccountId);

    const transferNumber = await this.nextNumber(organizationId);
    return this.repo.save(
      this.repo.create({
        organizationId,
        branchId: user.branchId!,
        transferNumber,
        date: dto.date,
        direction: dto.direction,
        bankAccountId: dto.bankAccountId,
        amount: dto.amount,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.repo.count({ where: { organizationId } });
    return `CBT-${String(count + 1).padStart(4, '0')}`;
  }
}
