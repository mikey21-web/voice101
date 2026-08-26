import { Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TalkToBuildService } from './talk-to-build.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TalkToBuildController {
  constructor(private talkToBuild: TalkToBuildService) {}

  @Post('transcribe-chunk')
  @Roles('OWNER', 'ADMIN')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeChunk(
    @UploadedFile() file: any,
    @Body() body: { language?: string },
  ) {
    if (!file?.buffer?.length) throw new Error('audio file is required');
    return this.talkToBuild.transcribeChunk(file.buffer, file.mimetype, body.language);
  }

  @Post('structure-prompt')
  @Roles('OWNER', 'ADMIN')
  structurePrompt(@Body() body: { transcript: string }) {
    return this.talkToBuild.structurePrompt(body.transcript);
  }

  @Post('onboarding-readiness')
  @Roles('OWNER', 'ADMIN')
  onboardingReadiness(@Body() body: { description: string }) {
    return this.talkToBuild.readiness(body.description);
  }

  @Post('voice-prompt')
  @Roles('OWNER', 'ADMIN')
  voicePrompt(@Body() body: { transcript: string; language?: string }) {
    return this.talkToBuild.voicePrompt(body.transcript, body.language);
  }

  @Post('draft-agent')
  @Roles('OWNER', 'ADMIN')
  async draftAgent(
    @Req() req: any,
    @Body()
    body: {
      channel?: string;
      description: string;
      business_name?: string;
      language?: string;
      create?: boolean;
    },
  ) {
    const draft = await this.talkToBuild.draftAgent({
      channel: body.channel,
      description: body.description,
      business_name: body.business_name,
      language: body.language,
    });
    if (!body.create) return draft;
    const employee = await this.talkToBuild.createEmployeeFromDraft(req.user.tenantId, draft, {
      channel: body.channel,
      language: body.language,
      businessName: body.business_name,
    });
    return { draft, employee };
  }
}
