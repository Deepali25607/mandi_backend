import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AdjustmentType } from '../adjustment.entity';

export class CreateAdjustmentDto {
  @IsDateString()
  date: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @IsNumber()
  actualValue: number;

  @IsNumber()
  reportedValue: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
