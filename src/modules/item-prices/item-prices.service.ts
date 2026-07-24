import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { ItemsService } from '@/modules/items/items.service';
import { User } from '@/modules/users/user.entity';
import { ItemPrice } from './item-price.entity';
import { SetItemPriceDto } from './dto/item-price.dto';

export interface LatestPriceRow {
  itemId: string;
  price: number;
  previousPrice: number | null;
  effectiveDate: string;
  updatedAt: Date;
}

@Injectable()
export class ItemPricesService {
  constructor(
    @InjectRepository(ItemPrice) private readonly repo: Repository<ItemPrice>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly items: ItemsService,
  ) {}

  /** Newest price per item — the values the rest of the app reflects. */
  async latest(organizationId: string): Promise<LatestPriceRow[]> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .distinctOn(['p.item_id'])
      .where('p.organization_id = :organizationId', { organizationId })
      .orderBy('p.item_id')
      .addOrderBy('p.created_at', 'DESC')
      .getMany();
    return rows.map((r) => ({
      itemId: r.itemId,
      price: r.price,
      previousPrice: r.previousPrice,
      effectiveDate: r.effectiveDate,
      updatedAt: r.createdAt,
    }));
  }

  /** Org-wide price-change log (all items), newest first — feeds the report. */
  async log(organizationId: string) {
    const rows = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: 2000,
    });
    const names = new Map<string, string>();
    if (rows.some((r) => r.createdByUserId)) {
      const found = await this.users.find({ where: { organizationId }, select: ['id', 'name'] });
      for (const u of found) names.set(u.id, u.name);
    }
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      price: r.price,
      previousPrice: r.previousPrice,
      effectiveDate: r.effectiveDate,
      notes: r.notes,
      updatedBy: r.createdByUserId ? names.get(r.createdByUserId) ?? '—' : '—',
      createdAt: r.createdAt,
    }));
  }

  /** Full audit trail for one item, newest first, with the updater's name. */
  async history(organizationId: string, itemId: string) {
    await this.items.findOne(organizationId, itemId); // 404 for foreign items
    const rows = await this.repo.find({
      where: { organizationId, itemId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const names = new Map<string, string>();
    if (rows.some((r) => r.createdByUserId)) {
      const found = await this.users.find({ where: { organizationId }, select: ['id', 'name'] });
      for (const u of found) names.set(u.id, u.name);
    }
    return rows.map((r) => ({
      id: r.id,
      price: r.price,
      previousPrice: r.previousPrice,
      effectiveDate: r.effectiveDate,
      notes: r.notes,
      updatedBy: r.createdByUserId ? names.get(r.createdByUserId) ?? '—' : '—',
      createdAt: r.createdAt,
    }));
  }

  /**
   * Record a price update. Append-only: never mutates old rows. Setting the
   * same price again is a no-op (returns the existing latest row) so the log
   * stays meaningful.
   */
  async set(user: AuthUser, dto: SetItemPriceDto): Promise<{ changed: boolean; price: ItemPrice }> {
    const organizationId = user.organizationId!;
    await this.items.findOne(organizationId, dto.itemId); // must exist in this org

    const current = await this.repo.findOne({
      where: { organizationId, itemId: dto.itemId },
      order: { createdAt: 'DESC' },
    });
    if (current && Number(current.price) === Number(dto.price)) {
      return { changed: false, price: current };
    }

    const row = await this.repo.save(
      this.repo.create({
        organizationId,
        itemId: dto.itemId,
        price: dto.price,
        previousPrice: current?.price ?? null,
        effectiveDate: dto.effectiveDate ?? new Date().toISOString().slice(0, 10),
        notes: dto.notes,
        createdByUserId: user.id,
      }),
    );
    return { changed: true, price: row };
  }
}
