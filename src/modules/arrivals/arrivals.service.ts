import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { LotStatus } from '@/common/enums/domain.enum';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { Arrival } from './arrival.entity';
import { ArrivalLine } from './arrival-line.entity';
import { CreateArrivalDto } from './dto/arrival.dto';

@Injectable()
export class ArrivalsService {
  constructor(
    @InjectRepository(Arrival) private readonly arrivals: Repository<Arrival>,
    private readonly dataSource: DataSource,
  ) {}

  list(organizationId: string, branchId: string): Promise<Arrival[]> {
    return this.arrivals.find({
      where: { organizationId, branchId },
      relations: { lines: true },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(organizationId: string, id: string): Promise<Arrival> {
    const arrival = await this.arrivals.findOne({
      where: { id, organizationId },
      relations: { lines: true },
    });
    if (!arrival) throw new NotFoundException('Arrival not found');
    return arrival;
  }

  /**
   * Creates an arrival + its lines, and spawns one stock lot per line.
   * All in a single transaction so stock and the arrival stay consistent.
   */
  async create(user: AuthUser, dto: CreateArrivalDto): Promise<Arrival> {
    const organizationId = user.organizationId!;
    const branchId = user.branchId!;

    const arrivalId = await this.dataSource.transaction(async (manager) => {
      const arrivalNumber = await this.nextArrivalNumber(manager, organizationId);

      let totalQuantity = 0;
      let totalWeight = 0;
      let totalValue = 0;

      const arrival = manager.create(Arrival, {
        organizationId,
        branchId,
        arrivalNumber,
        date: dto.date,
        supplierId: dto.supplierId,
        vehicleNumber: dto.vehicleNumber,
        notes: dto.notes,
        createdByUserId: user.id,
      });
      const savedArrival = await manager.save(arrival);

      const lines: ArrivalLine[] = [];
      let index = 1;
      for (const lineDto of dto.lines) {
        const lotNumber = `${arrivalNumber}-L${index}`;
        const amount = round2(lineDto.weight * lineDto.rate);

        lines.push(
          manager.create(ArrivalLine, {
            arrivalId: savedArrival.id,
            itemId: lineDto.itemId,
            lotNumber,
            quantity: lineDto.quantity,
            weight: lineDto.weight,
            rate: lineDto.rate,
            amount,
          }),
        );

        // One lot per line, fully available on creation.
        await manager.save(
          manager.create(StockLot, {
            organizationId,
            branchId,
            lotNumber,
            itemId: lineDto.itemId,
            supplierId: dto.supplierId,
            arrivalId: savedArrival.id,
            rate: lineDto.rate,
            qtyArrived: lineDto.quantity,
            weightArrived: lineDto.weight,
            qtyAvailable: lineDto.quantity,
            weightAvailable: lineDto.weight,
            status: LotStatus.ACTIVE,
            date: dto.date,
          }),
        );

        totalQuantity += lineDto.quantity;
        totalWeight += lineDto.weight;
        totalValue += amount;
        index += 1;
      }

      await manager.save(lines);
      savedArrival.totalQuantity = round2(totalQuantity);
      savedArrival.totalWeight = round2(totalWeight);
      savedArrival.totalValue = round2(totalValue);
      await manager.save(savedArrival);

      return savedArrival.id;
    });

    // Re-read after commit so relations are populated from a fresh query.
    return this.findOne(organizationId, arrivalId);
  }

  private async nextArrivalNumber(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const count = await manager.count(Arrival, { where: { organizationId } });
    return `ARR-${String(count + 1).padStart(4, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
