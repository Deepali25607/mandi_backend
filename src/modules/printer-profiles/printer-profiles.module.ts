import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterProfile } from './printer-profile.entity';
import { PrinterProfilesService } from './printer-profiles.service';
import { PrinterProfilesController } from './printer-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterProfile])],
  providers: [PrinterProfilesService],
  controllers: [PrinterProfilesController],
  exports: [PrinterProfilesService],
})
export class PrinterProfilesModule {}
