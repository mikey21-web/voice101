import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SwaraService } from './swara.service';

/** Swara — the guided-setup onboarding voice agent. Returns the question set for the frontend
 * wizard and the brief-structuring brain behind "she asks what you'd forget to type". */
@Controller('voice-swara')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SwaraController {
  constructor(private swara: SwaraService) {}

  @Get('questions')
  @Roles('OWNER', 'ADMIN')
  questions() {
    return this.swara.getQuestions();
  }

  @Get('greeting')
  @Roles('OWNER', 'ADMIN')
  greeting(@Body() body: { language?: string }) {
    return { greeting: this.swara.getGreeting(body.language || 'en') };
  }

  @Post('structure-brief')
  @Roles('OWNER', 'ADMIN')
  structure(@Body() body: { transcript: string; language?: string }) {
    return this.swara.structureBrief(body.transcript, body.language || 'en');
  }
}
