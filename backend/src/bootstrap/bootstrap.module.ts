import { Module } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { SeedDataService } from './seed-data.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SharedModule } from '../shared/shared.module';
import { CoachModule } from '../coach/coach.module';

@Module({
  imports: [PrismaModule, SharedModule, CoachModule],
  controllers: [],
  providers: [ConfigLoaderService, SeedDataService],
  exports: [ConfigLoaderService],
})
export class BootstrapModule {}
