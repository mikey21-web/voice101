import { Controller, Post, Get, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CopilotService } from './copilot.service';
import { ChatDto, ConfirmActionDto } from './dto/copilot.dto';
import { CallSummaryService } from '../call-tracking/call-summary.service';

@ApiTags('Copilot')
@Controller('copilot')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CopilotController {
  constructor(private service: CopilotService, private callSummary: CallSummaryService) {}

  /**
   * Whisper-quality voice command transcription. The browser's built-in
   * SpeechRecognition drops words and mishears accents; this sends the raw
   * audio to OpenAI Whisper (the same pipeline call recordings already use)
   * so "pull my hot leads and book a site visit" is heard correctly.
   */
  @Post('voice-transcribe')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'Transcribe a voice command audio clip via Whisper' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async transcribeVoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No audio file provided');
    const tmpPath = path.join(os.tmpdir(), `voice-${crypto.randomBytes(8).toString('hex')}.webm`);
    fs.writeFileSync(tmpPath, file.buffer);
    try {
      const text = await this.callSummary.transcribe(tmpPath);
      return { text };
    } finally {
      fs.unlink(tmpPath, () => {});
    }
  }

  @Post('chat')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'Send a chat message to the CRM copilot' })
  chat(@Body() dto: ChatDto, @Req() req) {
    return this.service.chat(req.user.sub, req.user.role, req.user.tenantId || 'default-tenant', dto.message, dto.conversationId);
  }

  @Post('confirm-action')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT')
  @ApiOperation({ summary: 'Confirm a pending high-impact action' })
  confirmAction(@Body() dto: ConfirmActionDto, @Req() req) {
    return this.service.confirmAction(req.user.sub, req.user.role, dto.pendingActionId);
  }

  /** Speaks a Mikey reply out loud via Cartesia TTS, returned as base64 mp3
   * so the frontend can play it without a separate authenticated audio route. */
  @Post('speak')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'Synthesize speech for a Mikey reply' })
  speak(@Body() dto: { text: string }) {
    return this.service.speak(dto.text);
  }

  /** Jarvis: decompose a goal into steps and start chaining tool calls through
   * the copilot pipeline, stopping only at approval-gated (payment/proposal) steps. */
  @Post('outcomes')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Define a Jarvis outcome and start running it' })
  startOutcome(@Body() dto: { goal: string; metric: string; target: number; current: number }, @Req() req) {
    return this.service.startOutcome(req.user.sub, req.user.role, req.user.tenantId || 'default-tenant', dto);
  }

  @Get('outcomes')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'List Jarvis outcomes for the current user' })
  listOutcomes(@Req() req) {
    return this.service.listOutcomes(req.user.sub, req.user.tenantId || 'default-tenant');
  }

  @Get('outcomes/:id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'Get a Jarvis outcome and its step progress' })
  getOutcome(@Param('id') id: string, @Req() req) {
    return this.service.getOutcome(id, req.user.tenantId || 'default-tenant');
  }

  @Post('outcomes/:id/cancel')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Cancel a running Jarvis outcome' })
  cancelOutcome(@Param('id') id: string, @Req() req) {
    return this.service.cancelOutcome(id, req.user.sub, req.user.tenantId || 'default-tenant');
  }

  @Get('conversations')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'List copilot conversations for the current user' })
  getConversations(@Req() req) {
    return this.service.getConversations(req.user.sub);
  }

  @Get('conversations/:id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER')
  @ApiOperation({ summary: 'Get full copilot conversation history' })
  getConversation(@Param('id') id: string, @Req() req) {
    return this.service.getConversation(id, req.user.sub);
  }
}
