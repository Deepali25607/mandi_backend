import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ArrivalLineDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsNumber()
  @Min(0)
  rate: number;
}

export class CreateArrivalDto {
  @IsDateString()
  date: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportCharges?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArrivalLineDto)
  lines: ArrivalLineDto[];
}

/**
 * Edit an arrival. All fields optional. Sending `lines` (or a changed
 * `supplierId`) is a structural edit and is only accepted while the arrival's
 * lots are untouched; header fields are always editable.
 */
export class UpdateArrivalDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportCharges?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArrivalLineDto)
  lines?: ArrivalLineDto[];
}
