import { Body, Controller, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequireFeature } from '@/common/decorators/feature.decorator';
import { PlatformFeature } from '@/common/enums/feature.enum';
import { VoiceService } from './voice.service';
import { VoiceCommandDto } from './dto/voice.dto';

// Paid add-on: only orgs whose plan enables it (Super Admin toggles per plan).
@RequireFeature(PlatformFeature.AI_ASSISTANT)
@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  // Open to any authenticated org user; the service enforces per-intent roles
  // (e.g. only accountants/admins can record an expense by voice).
  @Post('command')
  command(@CurrentUser() user: AuthUser, @Body() dto: VoiceCommandDto) {
    return this.voice.handleCommand(user, dto);
  }
}
