import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Item } from './item.entity';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
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

  private async nextCode(organizationId: string): Promise<string> {
    const count = await this.items.count({ where: { organizationId } });
    return `ITM-${String(count + 1).padStart(4, '0')}`;
  }
}
