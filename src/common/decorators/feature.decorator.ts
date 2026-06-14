import { SetMetadata } from '@nestjs/common';
import { PlatformFeature } from '@/common/enums/feature.enum';

export const FEATURE_KEY = 'requiredFeature';

/**
 * Marks a controller/handler as requiring a subscription feature.
 * Enforced by FeatureGuard against the organization's active plan.
 */
export const RequireFeature = (feature: PlatformFeature) => SetMetadata(FEATURE_KEY, feature);
