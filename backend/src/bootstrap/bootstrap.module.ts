import { Module } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { SeedDataService } from './seed-data.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SharedModule } from '../shared/shared.module';
import { CoachModule } from '../coach/coach.module';
import { DemoSeedService } from './demo-seed.service';
import { DemoSeedController } from './demo-seed.controller';

@Module({
  imports: [PrismaModule, SharedModule, CoachModule],
  controllers: [DemoSeedController],
  providers: [ConfigLoaderService, SeedDataService, DemoSeedService],
  exports: [ConfigLoaderService, DemoSeedService],
})
export class BootstrapModule {}
