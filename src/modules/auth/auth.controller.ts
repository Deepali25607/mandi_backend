import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { ROLE_LABELS } from '@/common/enums/role.enum';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RecoverDto,
  RegisterOrganizationDto,
  SecurityQuestionDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register-organization')
  registerOrganization(@Body() dto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(dto);
  }

  @Public()
  @Get('recovery-question')
  recoveryQuestion(@Query('username') username: string) {
    return this.authService.getRecoveryQuestion(username ?? '');
  }

  @Public()
  @Post('recover')
  @HttpCode(200)
  recover(@Body() dto: RecoverDto) {
    return this.authService.recover(dto);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  @Post('security-question')
  @HttpCode(200)
  setSecurityQuestion(@CurrentUser('id') userId: string, @Body() dto: SecurityQuestionDto) {
    return this.authService.setSecurityQuestion(userId, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { ...user, roleLabel: ROLE_LABELS[user.role] };
  }
}
