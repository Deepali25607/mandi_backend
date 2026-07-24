import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class SetItemPriceDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
