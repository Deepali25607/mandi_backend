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

export class ChallanLineDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsNumber() @Min(0) quantity: number;
  @IsNumber() @Min(0) weight: number;
  @IsNumber() @Min(0) rate: number;
}

export class CreateChallanDto {
  @IsDateString()
  date: string;

  @IsString()
  agentName: string;

  @IsOptional() @IsString() vehicleNumber?: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChallanLineDto)
  lines: ChallanLineDto[];
}

export class ReportChallanDto {
  @IsNumber() @Min(0) reportedSaleAmount: number;
  @IsOptional() @IsNumber() @Min(0) agentCommission?: number;
  @IsOptional() @IsNumber() @Min(0) otherCharges?: number;
}

export class SettleChallanDto {
  @IsDateString() settledDate: string;
  @IsNumber() @Min(0) settledAmount: number;
}
