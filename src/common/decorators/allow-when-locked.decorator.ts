import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_LOCKED_KEY = 'allowWhenLocked';

/**
 * Marks a write route as reachable even when the organization's subscription is
 * locked (read-only). Used for the "submit payment" endpoint so a locked tenant
 * can still pay. Reads (GET/HEAD) are always allowed by SubscriptionLockGuard.
 */
export const AllowWhenLocked = () => SetMetadata(ALLOW_WHEN_LOCKED_KEY, true);
