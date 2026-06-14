import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
  ) {}

  findAll(organizationId: string, search?: string): Promise<Customer[]> {
    return this.customers.find({
      where: search
        ? [
            { organizationId, name: ILike(`%${search}%`) },
            { organizationId, code: ILike(`%${search}%`) },
            { organizationId, area: ILike(`%${search}%`) },
          ]
        : { organizationId },
      order: { name: 'ASC' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<Customer> {
    const customer = await this.customers.findOne({ where: { id, organizationId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(organizationId: string, dto: CreateCustomerDto): Promise<Customer> {
    const code = dto.code?.trim() || (await this.nextCode(organizationId));
    return this.customers.save(this.customers.create({ ...dto, code, organizationId }));
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(organizationId, id);
    Object.assign(customer, dto);
    return this.customers.save(customer);
  }

  async remove(organizationId: string, id: string): Promise<Customer> {
    const customer = await this.findOne(organizationId, id);
    customer.isActive = false;
    return this.customers.save(customer);
  }

  private async nextCode(organizationId: string): Promise<string> {
    const count = await this.customers.count({ where: { organizationId } });
    return `CUST-${String(count + 1).padStart(4, '0')}`;
  }
}
