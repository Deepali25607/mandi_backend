import { Injectable, NotFoundException } from '@nestjs/common';
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

type UpdateCashTransferInput = Partial<CreateCashTransferInput>;

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

  async findOne(organizationId: string, id: string): Promise<CashTransfer> {
    const transfer = await this.repo.findOne({ where: { id, organizationId } });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async update(organizationId: string, id: string, dto: UpdateCashTransferInput): Promise<CashTransfer> {
    const transfer = await this.findOne(organizationId, id);
    if (dto.bankAccountId !== undefined && dto.bankAccountId !== transfer.bankAccountId) {
      await this.bankAccounts.assertUsable(organizationId, dto.bankAccountId);
      transfer.bankAccountId = dto.bankAccountId;
    }
    if (dto.date !== undefined) transfer.date = dto.date;
    if (dto.direction !== undefined) transfer.direction = dto.direction;
    if (dto.amount !== undefined) transfer.amount = dto.amount;
    if (dto.notes !== undefined) transfer.notes = dto.notes;
    return this.repo.save(transfer);
  }

  async remove(organizationId: string, id: string): Promise<{ deleted: true }> {
    await this.findOne(organizationId, id);
    await this.repo.delete({ id, organizationId });
    return { deleted: true };
  }

  // Derived from the highest existing number (not the row count) so numbers
  // stay unique even after transfers are deleted.
  private async nextNumber(organizationId: string): Promise<string> {
    const rows = await this.repo.find({ where: { organizationId }, select: ['transferNumber'] });
    const max = rows.reduce((m, r) => Math.max(m, Number(r.transferNumber.replace(/\D/g, '')) || 0), 0);
    return `CBT-${String(max + 1).padStart(4, '0')}`;
  }
}
