import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PrinterProfile } from './printer-profile.entity';
import { CreatePrinterProfileDto, UpdatePrinterProfileDto } from './dto/printer-profile.dto';

/** Sensible starting points so a fresh org isn't left with an empty list. */
const SEED: { name: string; widthMm: number; fontSize: number; isDefault: boolean }[] = [
  { name: '2 inch thermal (58mm)', widthMm: 58, fontSize: 9, isDefault: false },
  { name: '3 inch thermal (80mm)', widthMm: 80, fontSize: 10.5, isDefault: true },
  { name: '4 inch thermal (104mm)', widthMm: 104, fontSize: 11.5, isDefault: false },
];

@Injectable()
export class PrinterProfilesService {
  constructor(
    @InjectRepository(PrinterProfile) private readonly repo: Repository<PrinterProfile>,
  ) {}

  /**
   * Profiles for the org. First call seeds the three standard roll sizes so the
   * print menu is useful out of the box; they're editable/deletable like any other.
   */
  async list(organizationId: string): Promise<PrinterProfile[]> {
    const existing = await this.repo.find({ where: { organizationId }, order: { widthMm: 'ASC' } });
    if (existing.length > 0) return existing;
    await this.repo.save(
      SEED.map((s) =>
        this.repo.create({
          organizationId,
          name: s.name,
          widthMm: s.widthMm,
          fontSize: s.fontSize,
          marginMm: 2,
          isDefault: s.isDefault,
          isActive: true,
        }),
      ),
    );
    return this.repo.find({ where: { organizationId }, order: { widthMm: 'ASC' } });
  }

  async findOne(organizationId: string, id: string): Promise<PrinterProfile> {
    const p = await this.repo.findOne({ where: { id, organizationId } });
    if (!p) throw new NotFoundException('Printer not found');
    return p;
  }

  async create(organizationId: string, dto: CreatePrinterProfileDto): Promise<PrinterProfile> {
    const saved = await this.repo.save(
      this.repo.create({
        organizationId,
        name: dto.name.trim(),
        widthMm: dto.widthMm,
        fontSize: dto.fontSize ?? defaultFontFor(dto.widthMm),
        marginMm: dto.marginMm ?? 2,
        isDefault: dto.isDefault ?? false,
        isActive: true,
      }),
    );
    if (saved.isDefault) await this.clearOtherDefaults(organizationId, saved.id);
    return saved;
  }

  async update(organizationId: string, id: string, dto: UpdatePrinterProfileDto): Promise<PrinterProfile> {
    const p = await this.findOne(organizationId, id);
    if (dto.name !== undefined) p.name = dto.name.trim();
    if (dto.widthMm !== undefined) p.widthMm = dto.widthMm;
    if (dto.fontSize !== undefined) p.fontSize = dto.fontSize;
    if (dto.marginMm !== undefined) p.marginMm = dto.marginMm;
    if (dto.isDefault !== undefined) p.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
    const saved = await this.repo.save(p);
    if (saved.isDefault) await this.clearOtherDefaults(organizationId, saved.id);
    return saved;
  }

  async remove(organizationId: string, id: string): Promise<{ deleted: true }> {
    await this.findOne(organizationId, id);
    // Profiles aren't referenced by any record, so deleting is always safe.
    await this.repo.delete({ id, organizationId });
    return { deleted: true };
  }

  /** Only one default per org. */
  private async clearOtherDefaults(organizationId: string, keepId: string): Promise<void> {
    await this.repo.update({ organizationId, id: Not(keepId) }, { isDefault: false });
  }
}

/** Narrow rolls need smaller type to fit the columns. */
function defaultFontFor(widthMm: number): number {
  if (widthMm <= 60) return 9;
  if (widthMm <= 85) return 10.5;
  return 11.5;
}
