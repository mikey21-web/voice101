import { Module, forwardRef } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { LeadsModule } from '../leads/leads.module';
import { AutonomyGuardrailsService } from './autonomy-guardrails.service';
import { AutonomousActionService } from './autonomous-action.service';
import { PermissionGateService } from './permission-gate.service';

@Module({
  imports: [ConversationsModule, forwardRef(() => LeadsModule)],
  providers: [AutonomyGuardrailsService, AutonomousActionService, PermissionGateService],
  exports: [AutonomyGuardrailsService, AutonomousActionService, PermissionGateService],
})
export class MikeyModule {}
