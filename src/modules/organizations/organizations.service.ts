import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppearanceConfig, DEFAULT_APPEARANCE, Organization } from './organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private readonly repo: Repository<Organization>,
  ) {}

  async findOne(id: string): Promise<Organization> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, dto: Partial<Organization>): Promise<Organization> {
    const org = await this.findOne(id);
    Object.assign(org, dto);
    return this.repo.save(org);
  }

  /** Current tenant's appearance, or the built-in default if never customised. */
  async getAppearance(id: string): Promise<AppearanceConfig> {
    const org = await this.findOne(id);
    return org.appearance ?? DEFAULT_APPEARANCE;
  }

  async updateAppearance(id: string, config: AppearanceConfig): Promise<AppearanceConfig> {
    const org = await this.findOne(id);
    org.appearance = config;
    await this.repo.save(org);
    return config;
  }
}
