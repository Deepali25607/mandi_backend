import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { TransferDirection } from '@/common/enums/domain.enum';

export class CreateCashTransferDto {
  @IsDateString()
  date: string;

  @IsEnum(TransferDirection)
  direction: TransferDirection;

  @IsUUID()
  bankAccountId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCashTransferDto extends PartialType(CreateCashTransferDto) {}
