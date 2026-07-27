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

export class PreviewBillDto {
  @IsUUID()
  supplierId: string;

  /** Optional: settle only this item's lots (else all of the supplier's items). */
  @IsOptional()
  @IsUUID()
  itemId?: string;

  /** Optional: settle a single lot (lot-wise settlement). */
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}

export class CreateBillDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsDateString()
  date: string;

  @IsOptional() @IsNumber() @Min(0) labourCharges?: number;
  @IsOptional() @IsNumber() @Min(0) crateCharges?: number;
  @IsOptional() @IsNumber() @Min(0) otherCharges?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePaymentDto {
  @IsUUID()
  supplierId: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional() @IsEnum(PaymentMode) paymentMode?: PaymentMode;
  @IsOptional() @IsUUID() billId?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}
