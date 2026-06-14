import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { BillingCycle, PlatformFeature, SubscriptionStatus } from '@/common/enums/feature.enum';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'code must be lowercase letters, numbers or hyphens' })
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  priceMonthly: number;

  @IsNumber()
  @Min(0)
  priceYearly: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number | null;

  @IsArray()
  @IsEnum(PlatformFeature, { each: true })
  features: PlatformFeature[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

/** Super Admin updating a tenant's subscription / status. */
export class UpdateOrganizationAdminDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  planId?: string | null;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsString()
  renewalDate?: string | null;
}

export class UpdateSettingDto {
  @IsString()
  value: string;
}

class BrandingBackgroundDto {
  @IsIn(['gradient', 'color', 'image'])
  type: 'gradient' | 'color' | 'image';

  // Hex / CSS gradient / base64 data URL (≤ ~3 MB inlined image, dev-only).
  @IsString()
  @MaxLength(4_000_000)
  value: string;
}

/** Super Admin editing the public login-screen branding. */
export class UpdateBrandingDto {
  @IsString()
  @MaxLength(60)
  appName: string;

  @IsString()
  @MaxLength(120)
  tagline: string;

  @IsHexColor()
  primaryColor: string;

  @ValidateNested()
  @Type(() => BrandingBackgroundDto)
  background: BrandingBackgroundDto;
}
