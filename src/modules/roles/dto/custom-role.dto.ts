import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCustomRoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /** Granted screen paths. Unknown paths are dropped server-side. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  screens: string[];
}

export class UpdateCustomRoleDto extends PartialType(CreateCustomRoleDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
