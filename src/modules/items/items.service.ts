import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { nextDocNumber } from '@/common/utils/doc-number.util';
import { Adjustment } from '@/modules/adjustments/adjustment.entity';
import { ArrivalLine } from '@/modules/arrivals/arrival-line.entity';
import { ChallanLine } from '@/modules/challans/challan-line.entity';
import { StockLot } from '@/modules/inventory/stock-lot.entity';
import { SaleLine } from '@/modules/sales/sale-line.entity';
import { Item } from './item.entity';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(StockLot) private readonly stockLots: Repository<StockLot>,
    @InjectRepository(ArrivalLine) private readonly arrivalLines: Repository<ArrivalLine>,
    @InjectRepository(SaleLine) private readonly saleLines: Repository<SaleLine>,
    @InjectRepository(ChallanLine) private readonly challanLines: Repository<ChallanLine>,
    @InjectRepository(Adjustment) private readonly adjustments: Repository<Adjustment>,
  ) {}

  findAll(organizationId: string, search?: string): Promise<Item[]> {
    return this.items.find({
      where: search
        ? [
            { organizationId, name: ILike(`%${search}%`) },
            { organizationId, code: ILike(`%${search}%`) },
          ]
        : { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<Item> {
    const item = await this.items.findOne({ where: { id, organizationId } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async create(organizationId: string, dto: CreateItemDto): Promise<Item> {
    const code = dto.code?.trim() || (await this.nextCode(organizationId));
    const item = this.items.create({ ...dto, code, organizationId });
    return this.items.save(item);
  }

  async update(organizationId: string, id: string, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(organizationId, id);
    Object.assign(item, dto);
    return this.items.save(item);
  }

  /** Archive (soft delete) so historical transactions keep referencing the item. */
  async remove(organizationId: string, id: string): Promise<Item> {
    const item = await this.findOne(organizationId, id);
    item.isActive = false;
    return this.items.save(item);
  }

  /**
   * Hard delete (Org Admin only). Refused while any transaction references the
   * item — deleting it would orphan arrival/sale/stock history.
   */
  async removePermanently(organizationId: string, id: string): Promise<{ deleted: true }> {
    const item = await this.findOne(organizationId, id);
    const [lots, arrivals, sales, challans, adjustments] = await Promise.all([
      this.stockLots.count({ where: { itemId: id } }),
      this.arrivalLines.count({ where: { itemId: id } }),
      this.saleLines.count({ where: { itemId: id } }),
      this.challanLines.count({ where: { itemId: id } }),
      this.adjustments.count({ where: { itemId: id } }),
    ]);
    const used: string[] = [];
    if (arrivals) used.push(`${arrivals} arrival line(s)`);
    if (sales) used.push(`${sales} sale line(s)`);
    if (lots) used.push(`${lots} stock lot(s)`);
    if (challans) used.push(`${challans} challan line(s)`);
    if (adjustments) used.push(`${adjustments} adjustment(s)`);
    if (used.length > 0) {
      throw new ConflictException(
        `"${item.name}" is used by ${used.join(', ')} — archive it instead of deleting.`,
      );
    }
    await this.items.delete({ id, organizationId });
    return { deleted: true };
  }

  private nextCode(organizationId: string): Promise<string> {
    return nextDocNumber(this.items.manager, 'items', 'code', 'ITM', organizationId);
  }
}
