import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdvancedFeaturesService } from './advanced-features.service';
import { AdvancedFeaturesController } from './advanced-features.controller';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'sla-evaluator' }), forwardRef(() => ContactsModule), forwardRef(() => LeadsModule)],
  controllers: [AdvancedFeaturesController],
  providers: [AdvancedFeaturesService],
  exports: [AdvancedFeaturesService],
})
export class AdvancedFeaturesModule {}
