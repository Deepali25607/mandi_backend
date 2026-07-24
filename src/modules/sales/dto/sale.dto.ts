import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMode } from '@/common/enums/domain.enum';

export class SaleLineDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsNumber()
  @Min(0)
  rate: number;

  /** Actual rate payable to the supplier (Commission lots, Org Admin only). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  supplierRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  marketFeePct?: number;
}

export class CreateSaleDto {
  @IsDateString()
  date: string;

  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Extra charges billed to the customer (bhada, palledari…). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  otherChargesNote?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines: SaleLineDto[];
}

/**
 * Edit a sale. All fields optional. Sending `lines` is a structural edit and is
 * only accepted while the sale is not part of a finalised supplier settlement;
 * header fields are always editable.
 */
export class UpdateSaleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  otherChargesNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines?: SaleLineDto[];
}
