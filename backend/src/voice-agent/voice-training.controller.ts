import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceTrainingService } from './voice-training.service';

@Controller('voice-training')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceTrainingController {
  constructor(private training: VoiceTrainingService) {}

  @Post()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  createExample(
    @Req() req: any,
    @Body()
    body: {
      employeeId: string;
      callId?: string;
      issue: string;
      correction: string;
      context?: string;
    },
  ) {
    return this.training.createExample(
      req.user.tenantId,
      body.employeeId,
      body.callId || null,
      body.issue,
      body.correction,
      body.context,
      req.user.sub,
    );
  }

  @Get('employee/:employeeId')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  listExamples(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.training.listExamples(req.user.tenantId, employeeId, 'active');
  }

  @Patch(':id/archive')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  archiveExample(@Param('id') id: string) {
    return this.training.archiveExample(id);
  }
}
