import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LLMHealthService } from './llm-health.service';

@Controller('llm-health')
@UseGuards(JwtAuthGuard)
export class LLMHealthController {
  constructor(private llmHealth: LLMHealthService) {}

  @Get('status')
  getStatus() {
    return this.llmHealth.getStatus();
  }

  @Get('current')
  getCurrentProvider() {
    const provider = this.llmHealth.getCurrentProvider();
    return { provider: provider.provider, model: provider.model };
  }
}
