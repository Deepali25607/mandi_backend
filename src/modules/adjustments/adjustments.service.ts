import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { Adjustment, AdjustmentType } from './adjustment.entity';

interface CreateAdjustmentInput {
  date: string;
  supplierId: string;
  itemId?: string;
  type: AdjustmentType;
  actualValue: number;
  reportedValue: number;
  amount: number;
  notes?: string;
}

@Injectable()
export class AdjustmentsService {
  constructor(
    @InjectRepository(Adjustment) private readonly repo: Repository<Adjustment>,
  ) {}

  list(organizationId: string, branchId: string, supplierId?: string): Promise<Adjustment[]> {
    return this.repo.find({
      where: { organizationId, branchId, ...(supplierId ? { supplierId } : {}) },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
  }

  async create(user: AuthUser, dto: CreateAdjustmentInput): Promise<Adjustment> {
    const organizationId = user.organizationId!;
    const number = await this.nextNumber(organizationId);
    return this.repo.save(
      this.repo.create({
        organizationId,
        branchId: user.branchId!,
        adjustmentNumber: number,
        date: dto.date,
        supplierId: dto.supplierId,
        itemId: dto.itemId ?? null,
        type: dto.type,
        actualValue: dto.actualValue,
        reportedValue: dto.reportedValue,
        amount: dto.amount,
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
  }

  /** Signed adjustment total per supplier (for outstanding & ledger). */
  async totalsBySupplier(organizationId: string): Promise<Map<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.supplier_id', 'supplierId')
      .addSelect('SUM(a.amount)', 'total')
      .where('a.organization_id = :organizationId', { organizationId })
      .groupBy('a.supplier_id')
      .getRawMany<{ supplierId: string; total: string }>();
    return new Map(rows.map((r) => [r.supplierId, parseFloat(r.total)]));
  }

  listBySupplier(organizationId: string, supplierId: string): Promise<Adjustment[]> {
    return this.repo.find({
      where: { organizationId, supplierId },
      order: { date: 'ASC' },
    });
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.repo.count({ where: { organizationId } });
    return `ADJ-${String(count + 1).padStart(4, '0')}`;
  }
}
