import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Supplier } from './supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
  ) {}

  findAll(organizationId: string, search?: string): Promise<Supplier[]> {
    return this.suppliers.find({
      where: search
        ? [
            { organizationId, name: ILike(`%${search}%`) },
            { organizationId, code: ILike(`%${search}%`) },
            { organizationId, village: ILike(`%${search}%`) },
          ]
        : { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findOne({ where: { id, organizationId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(organizationId: string, dto: CreateSupplierDto): Promise<Supplier> {
    const code = dto.code?.trim() || (await this.nextCode(organizationId));
    return this.suppliers.save(this.suppliers.create({ ...dto, code, organizationId }));
  }

  async update(organizationId: string, id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(organizationId, id);
    Object.assign(supplier, dto);
    return this.suppliers.save(supplier);
  }

  async remove(organizationId: string, id: string): Promise<Supplier> {
    const supplier = await this.findOne(organizationId, id);
    supplier.isActive = false;
    return this.suppliers.save(supplier);
  }

  private async nextCode(organizationId: string): Promise<string> {
    const count = await this.suppliers.count({ where: { organizationId } });
    return `SUP-${String(count + 1).padStart(4, '0')}`;
  }
}
