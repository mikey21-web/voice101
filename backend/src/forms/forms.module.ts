import { Module } from '@nestjs/common';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsModule } from '../leads/leads.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AgentModule } from '../agent/agent.module';
import { VoiceAgentModule } from '../voice-agent/voice-agent.module';

@Module({
  imports: [ContactsModule, LeadsModule, ConversationsModule, AgentModule, VoiceAgentModule],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
