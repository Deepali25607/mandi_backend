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
  // Manual (offline) subscription payment details shown to tenants on the
  // "Subscribe / Pay" screen — there is no online payment gateway.
  { key: 'payment_upi', label: 'Payment UPI ID', value: 'mandierp@upi' },
  { key: 'payment_bank', label: 'Payment bank details', value: 'A/c 000000000000 · IFSC XXXX0000000 · Mandi ERP' },
  {
    key: 'payment_instructions',
    label: 'Payment instructions (shown to tenants)',
    value: 'Pay the amount via UPI or bank transfer, then submit the transaction reference below. Your subscription is activated once the platform team verifies the payment.',
  },
];

/** Look of the public login / register / recovery screens (Super-Admin managed). */
export interface PlatformBranding {
  appName: string;
  tagline: string;
  primaryColor: string;
  background: { type: 'gradient' | 'color' | 'image'; value: string };
}

const BRANDING_KEY = 'branding';
export const DEFAULT_BRANDING: PlatformBranding = {
  appName: 'Mandi ERP',
  tagline: 'Sabzi Mandi Accounting & Inventory',
  primaryColor: '#1f8a4c',
  background: { type: 'gradient', value: 'linear-gradient(160deg, #1f8a4c 0%, #13652f 60%, #0e4a23 100%)' },
};

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
    }
    // `branding` is a JSON blob edited on its own screen — keep it out of the
    // plain key/value settings list.
    const all = missing.length ? await this.repo.find() : existing;
    return all.filter((s) => s.key !== BRANDING_KEY).sort((a, b) => a.key.localeCompare(b.key));
  }

  /** Login-screen branding, falling back to the built-in default. */
  async getBranding(): Promise<PlatformBranding> {
    const s = await this.repo.findOne({ where: { key: BRANDING_KEY } });
    if (!s?.value) return DEFAULT_BRANDING;
    try {
      return { ...DEFAULT_BRANDING, ...(JSON.parse(s.value) as Partial<PlatformBranding>) };
    } catch {
      return DEFAULT_BRANDING;
    }
  }

  async setBranding(config: PlatformBranding): Promise<PlatformBranding> {
    let s = await this.repo.findOne({ where: { key: BRANDING_KEY } });
    if (!s) s = this.repo.create({ key: BRANDING_KEY, label: 'Login screen branding' });
    s.value = JSON.stringify(config);
    await this.repo.save(s);
    return config;
  }

  /** Read a single setting's value, falling back to its built-in default. */
  async getValue(key: string): Promise<string | null> {
    const s = await this.repo.findOne({ where: { key } });
    if (s?.value != null) return s.value;
    return DEFAULTS.find((d) => d.key === key)?.value ?? null;
  }

  /** Default trial length in days (from the `trial_days` setting; fallback 14). */
  async getTrialDays(): Promise<number> {
    const raw = await this.getValue('trial_days');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
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
