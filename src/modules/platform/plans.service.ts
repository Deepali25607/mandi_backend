import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { CreatePlanDto, UpdatePlanDto } from './dto/platform.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(SubscriptionPlan) private readonly plans: Repository<SubscriptionPlan>,
  ) {}

  findAll(): Promise<SubscriptionPlan[]> {
    return this.plans.find({ order: { sortOrder: 'ASC', priceMonthly: 'ASC' } });
  }

  /** Active + public plans for the registration/pricing screen. */
  findPublic(): Promise<SubscriptionPlan[]> {
    return this.plans.find({ where: { isActive: true, isPublic: true }, order: { sortOrder: 'ASC', priceMonthly: 'ASC' } });
  }

  async findOne(id: string): Promise<SubscriptionPlan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  /** The plan assigned to brand-new organizations. */
  findDefault(): Promise<SubscriptionPlan | null> {
    return this.plans.findOne({ where: { isDefault: true, isActive: true } });
  }

  async create(dto: CreatePlanDto): Promise<SubscriptionPlan> {
    const exists = await this.plans.findOne({ where: { code: dto.code } });
    if (exists) throw new BadRequestException('A plan with this code already exists');
    if (dto.isDefault) await this.clearDefault();
    return this.plans.save(this.plans.create(dto));
  }

  async update(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
    const plan = await this.findOne(id);
    if (dto.code && dto.code !== plan.code) {
      const clash = await this.plans.findOne({ where: { code: dto.code, id: Not(id) } });
      if (clash) throw new BadRequestException('A plan with this code already exists');
    }
    if (dto.isDefault) await this.clearDefault(id);
    Object.assign(plan, dto);
    return this.plans.save(plan);
  }

  private async clearDefault(exceptId?: string): Promise<void> {
    const where = exceptId ? { isDefault: true, id: Not(exceptId) } : { isDefault: true };
    await this.plans.update(where, { isDefault: false });
  }
}
