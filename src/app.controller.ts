import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return { name: 'Mandi ERP API', status: 'ok' };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
