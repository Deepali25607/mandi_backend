import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const USERNAME_RULE = /^[a-zA-Z0-9._-]+$/;

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  organizationName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(USERNAME_RULE, { message: 'Username may contain letters, numbers, dot, dash and underscore only' })
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  /** Optional chosen subscription plan; falls back to the platform default. */
  @IsOptional()
  @IsString()
  planId?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}

export class SecurityQuestionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  question: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  answer: string;
}

export class RecoverDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword: string;
}
