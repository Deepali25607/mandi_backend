import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MaxLength(160) location?: string;
  @IsOptional() @IsString() @MaxLength(160) contactDetails?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
