import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BillingCycle } from '@/common/enums/feature.enum';
import { SubscriptionPaymentMethod } from '../subscription-payment.entity';

/** Org admin submitting a manual payment for review. */
export class RequestSubscriptionPaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @IsEnum(SubscriptionPaymentMethod)
  method: SubscriptionPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Optional: plan being paid for; defaults to the org's current plan. */
  @IsOptional()
  @IsString()
  planId?: string;
}

/** Super Admin rejecting a payment (approval needs no body). */
export class ReviewSubscriptionPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
