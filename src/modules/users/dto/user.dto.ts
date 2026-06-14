import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';

const USERNAME_RULE = /^[a-zA-Z0-9._-]+$/;

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(USERNAME_RULE, { message: 'Username may contain letters, numbers, dot, dash and underscore only' })
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}
