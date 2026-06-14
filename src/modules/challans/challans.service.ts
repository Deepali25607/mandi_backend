import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { LotStatus } from '@/common/enums/domain.enum';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Challan, ChallanStatus } from './challan.entity';
import { ChallanLine } from './challan-line.entity';
import {
  ChallanLineDto,
  CreateChallanDto,
  ReportChallanDto,
  SettleChallanDto,
} from './dto/challan.dto';

@Injectable()
export class ChallansService {
  constructor(
    @InjectRepository(Challan) private readonly challans: Repository<Challan>,
    private readonly dataSource: DataSource,
  ) {}

  list(organizationId: string, branchId: string): Promise<Challan[]> {
    return this.challans.find({
      where: { organizationId, branchId },
      relations: { lines: true },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(organizationId: string, id: string): Promise<Challan> {
    const challan = await this.challans.findOne({ where: { id, organizationId }, relations: { lines: true } });
    if (!challan) throw new NotFoundException('Challan not found');
    return challan;
  }

  /** Transfer stock to another agent — draws down lots, like a sale. */
  async create(user: AuthUser, dto: CreateChallanDto): Promise<Challan> {
    const organizationId = user.organizationId!;
    const branchId = user.branchId!;

    const challanId = await this.dataSource.transaction(async (manager) => {
      const challanNumber = await this.nextNumber(manager, organizationId);
      let totalQuantity = 0;
      let totalWeight = 0;
      let costValue = 0;

      const challan = await manager.save(
        manager.create(Challan, {
          organizationId,
          branchId,
          challanNumber,
          date: dto.date,
          agentName: dto.agentName,
          vehicleNumber: dto.vehicleNumber,
          notes: dto.notes,
          status: ChallanStatus.TRANSFERRED,
          createdByUserId: user.id,
        }),
      );

      const lines: ChallanLine[] = [];
      for (const lineDto of dto.lines) {
        if (lineDto.lotId) await this.drawDownLot(manager, organizationId, branchId, lineDto);
        lines.push(
          manager.create(ChallanLine, {
            challanId: challan.id,
            itemId: lineDto.itemId,
            lotId: lineDto.lotId ?? null,
            quantity: lineDto.quantity,
            weight: lineDto.weight,
            rate: lineDto.rate,
          }),
        );
        totalQuantity += lineDto.quantity;
        totalWeight += lineDto.weight;
        costValue += lineDto.weight * lineDto.rate;
      }
      await manager.save(lines);

      challan.totalQuantity = round2(totalQuantity);
      challan.totalWeight = round2(totalWeight);
      challan.costValue = round2(costValue);
      await manager.save(challan);
      return challan.id;
    });

    return this.findOne(organizationId, challanId);
  }

  /** Record the bikri (sale) report from the other agent. */
  async report(organizationId: string, id: string, dto: ReportChallanDto): Promise<Challan> {
    const challan = await this.findOne(organizationId, id);
    if (challan.status === ChallanStatus.SETTLED) {
      throw new BadRequestException('Challan already settled');
    }
    challan.reportedSaleAmount = dto.reportedSaleAmount;
    challan.agentCommission = dto.agentCommission ?? 0;
    challan.otherCharges = dto.otherCharges ?? 0;
    challan.netReceivable = round2(dto.reportedSaleAmount - (dto.agentCommission ?? 0) - (dto.otherCharges ?? 0));
    challan.status = ChallanStatus.REPORTED;
    await this.challans.save(challan);
    return this.findOne(organizationId, id);
  }

  /** Record settlement (money received from the other agent). */
  async settle(organizationId: string, id: string, dto: SettleChallanDto): Promise<Challan> {
    const challan = await this.findOne(organizationId, id);
    if (challan.status === ChallanStatus.TRANSFERRED) {
      throw new BadRequestException('Record the bikri report before settling');
    }
    challan.settledAmount = dto.settledAmount;
    challan.settledDate = dto.settledDate;
    challan.status = ChallanStatus.SETTLED;
    await this.challans.save(challan);
    return this.findOne(organizationId, id);
  }

  private async drawDownLot(
    manager: EntityManager,
    organizationId: string,
    branchId: string,
    line: ChallanLineDto,
  ): Promise<void> {
    const lot = await manager.findOne(StockLot, { where: { id: line.lotId, organizationId, branchId } });
    if (!lot) throw new BadRequestException('Stock lot not found for this branch');
    if (line.weight > lot.weightAvailable + 0.001) {
      throw new BadRequestException(`Lot ${lot.lotNumber}: only ${lot.weightAvailable} available, ${line.weight} requested`);
    }
    lot.weightAvailable = round2(lot.weightAvailable - line.weight);
    lot.qtyAvailable = round2(Math.max(0, lot.qtyAvailable - line.quantity));
    if (lot.weightAvailable <= 0.001 && lot.qtyAvailable <= 0.001) {
      lot.status = LotStatus.CLOSED;
      lot.weightAvailable = 0;
      lot.qtyAvailable = 0;
    }
    await manager.save(lot);
  }

  private async nextNumber(manager: EntityManager, organizationId: string): Promise<string> {
    const count = await manager.count(Challan, { where: { organizationId } });
    return `CH-${String(count + 1).padStart(4, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
