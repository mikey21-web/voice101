import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CoachService } from './coach.service';
import { CoachAnalysisService } from './coach-analysis.service';
import { CoachController } from './coach.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CoachController],
  providers: [CoachService, CoachAnalysisService],
  exports: [CoachService],
})
export class CoachModule {}
