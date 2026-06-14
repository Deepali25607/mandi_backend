import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './branch.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly repo: Repository<Branch>,
  ) {}

  list(organizationId: string): Promise<Branch[]> {
    return this.repo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  create(organizationId: string, dto: Partial<Branch>): Promise<Branch> {
    return this.repo.save(this.repo.create({ ...dto, organizationId }));
  }

  async update(organizationId: string, id: string, dto: Partial<Branch>): Promise<Branch> {
    const branch = await this.repo.findOne({ where: { id, organizationId } });
    if (!branch) throw new NotFoundException('Branch not found');
    Object.assign(branch, dto);
    return this.repo.save(branch);
  }
}
