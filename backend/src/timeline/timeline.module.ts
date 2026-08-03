import { Global, Module, forwardRef } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';

@Global()
@Module({
  imports: [forwardRef(() => LeadsModule)],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
