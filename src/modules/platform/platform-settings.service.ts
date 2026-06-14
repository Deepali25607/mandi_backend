import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './platform-setting.entity';

/** Default platform settings, seeded on first read if missing. */
const DEFAULTS: { key: string; label: string; value: string }[] = [
  { key: 'platform_name', label: 'Platform name', value: 'Mandi ERP' },
  { key: 'support_email', label: 'Support email', value: 'support@mandierp.local' },
  { key: 'support_mobile', label: 'Support mobile', value: '1800-000-000' },
  { key: 'trial_days', label: 'Default trial length (days)', value: '14' },
  { key: 'allow_self_registration', label: 'Allow organization self-registration', value: 'true' },
];

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSetting) private readonly repo: Repository<PlatformSetting>,
  ) {}

  async findAll(): Promise<PlatformSetting[]> {
    const existing = await this.repo.find();
    const known = new Set(existing.map((s) => s.key));
    const missing = DEFAULTS.filter((d) => !known.has(d.key));
    if (missing.length) {
      await this.repo.save(missing.map((d) => this.repo.create(d)));
      return this.repo.find({ order: { key: 'ASC' } });
    }
    return existing.sort((a, b) => a.key.localeCompare(b.key));
  }

  async update(key: string, value: string): Promise<PlatformSetting> {
    let setting = await this.repo.findOne({ where: { key } });
    if (!setting) {
      const def = DEFAULTS.find((d) => d.key === key);
      setting = this.repo.create({ key, value, label: def?.label });
    } else {
      setting.value = value;
    }
    return this.repo.save(setting);
  }
}
