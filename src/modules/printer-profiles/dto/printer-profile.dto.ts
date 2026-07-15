import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePrinterProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** 20mm covers the narrowest label rolls; 210mm is A4 width. */
  @IsNumber()
  @Min(20)
  @Max(210)
  widthMm: number;

  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(24)
  fontSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  marginMm?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePrinterProfileDto extends PartialType(CreatePrinterProfileDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
