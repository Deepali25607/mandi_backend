import {
  IsEnum,
  IsInt,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { CrateDirection, CrateParty } from '../crate-transaction.entity';

export class CreateCrateDto {
  @IsDateString()
  date: string;

  @IsEnum(CrateParty)
  partyType: CrateParty;

  @IsUUID()
  partyId: string;

  @IsEnum(CrateDirection)
  direction: CrateDirection;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  damaged?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
