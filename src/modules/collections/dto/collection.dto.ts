import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentMode } from '@/common/enums/domain.enum';

export class CreateCollectionDto {
  @IsDateString()
  date: string;

  @IsUUID()
  customerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  /** Bank account for bank-linked modes (UPI / Bank). Ignored for cash/credit. */
  @IsOptional()
  @IsUUID()
  bankAccountId?: string | null;

  /** Bank/transaction charges deducted at source (net to bank = amount − charges). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  charges?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
