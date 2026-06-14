import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ItemCategory } from '@/common/enums/domain.enum';

export class CreateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsEnum(ItemCategory)
  category: ItemCategory;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommissionPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultMarketFeePct?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateItemDto extends PartialType(CreateItemDto) {}
