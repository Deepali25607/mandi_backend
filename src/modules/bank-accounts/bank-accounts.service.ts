import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from '@/modules/collections/collection.entity';
import { BankAccount } from './bank-account.entity';
import { CreateBankAccountDto, UpdateBankAccountDto } from './dto/bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectRepository(BankAccount) private readonly repo: Repository<BankAccount>,
    @InjectRepository(Collection) private readonly collections: Repository<Collection>,
  ) {}

  list(organizationId: string): Promise<BankAccount[]> {
    return this.repo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async findOne(organizationId: string, id: string): Promise<BankAccount> {
    const account = await this.repo.findOne({ where: { id, organizationId } });
    if (!account) throw new NotFoundException('Bank account not found');
    return account;
  }

  create(organizationId: string, branchId: string | null, dto: CreateBankAccountDto): Promise<BankAccount> {
    return this.repo.save(
      this.repo.create({
        organizationId,
        branchId: branchId ?? null,
        name: dto.name.trim(),
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        openingBalance: dto.openingBalance ?? 0,
        isActive: true,
      }),
    );
  }

  async update(organizationId: string, id: string, dto: UpdateBankAccountDto): Promise<BankAccount> {
    const account = await this.findOne(organizationId, id);
    if (dto.name !== undefined) account.name = dto.name.trim();
    if (dto.bankName !== undefined) account.bankName = dto.bankName;
    if (dto.accountNumber !== undefined) account.accountNumber = dto.accountNumber;
    if (dto.openingBalance !== undefined) account.openingBalance = dto.openingBalance;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;
    return this.repo.save(account);
  }

  async remove(organizationId: string, id: string): Promise<{ deleted: true }> {
    await this.findOne(organizationId, id);
    const used = await this.collections.count({ where: { organizationId, bankAccountId: id } });
    if (used > 0) {
      throw new ConflictException(
        `This account is used by ${used} collection(s). Disable it instead of deleting.`,
      );
    }
    await this.repo.delete({ id, organizationId });
    return { deleted: true };
  }

  /** Validates an account id belongs to the org and is active; returns it or throws. */
  async assertUsable(organizationId: string, id: string): Promise<BankAccount> {
    const account = await this.findOne(organizationId, id);
    if (!account.isActive) throw new ConflictException('That bank account is disabled.');
    return account;
  }
}
