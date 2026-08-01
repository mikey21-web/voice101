import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

interface LLMProvider {
  provider: 'openai' | 'groq' | 'gemini';
  apiKey: string;
  model: string;
  failureCount: number;
  lastTestedAt: Date | null;
}

@Injectable()
export class LLMHealthService {
  private readonly logger = new Logger(LLMHealthService.name);
  private providers: LLMProvider[] = [];
  private currentProviderIndex = 0;

  constructor(private config: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');

    if (openaiKey) this.providers.push({ provider: 'openai', apiKey: openaiKey, model: 'gpt-4o-mini', failureCount: 0, lastTestedAt: null });
    if (groqKey) this.providers.push({ provider: 'groq', apiKey: groqKey, model: 'llama-3.3-70b-versatile', failureCount: 0, lastTestedAt: null });
    if (geminiKey) this.providers.push({ provider: 'gemini', apiKey: geminiKey, model: 'gemini-2.0-flash', failureCount: 0, lastTestedAt: null });

    if (this.providers.length === 0) {
      this.logger.warn('No LLM provider keys configured');
      return;
    }

    this.logger.log(`Initialized ${this.providers.length} LLM providers`);
  }

  @Interval(60000)
  async checkHealth() {
    if (this.providers.length === 0) return;

    for (const provider of this.providers) {
      const isHealthy = await this.testProvider(provider);
      if (isHealthy) {
        provider.failureCount = Math.max(0, provider.failureCount - 1);
      } else {
        provider.failureCount++;
      }
      provider.lastTestedAt = new Date();
    }

    this.rotateToHealthyProvider();
  }

  private async testProvider(provider: LLMProvider): Promise<boolean> {
    try {
      if (provider.provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
        });
        return res.ok || res.status !== 429;
      } else if (provider.provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
        });
        return res.ok;
      } else if (provider.provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ok' }] }] }),
        });
        return res.ok || res.status !== 429;
      }
      return false;
    } catch {
      return false;
    }
  }

  private rotateToHealthyProvider() {
    const allDead = this.providers.every((p) => p.failureCount >= 3);
    if (allDead) {
      this.logger.error('All LLM providers are dead');
      return;
    }

    const bestProvider = this.providers
      .filter((p) => p.failureCount < 3)
      .sort((a, b) => a.failureCount - b.failureCount)[0];

    const bestIndex = this.providers.indexOf(bestProvider);
    if (bestIndex !== this.currentProviderIndex) {
      const oldProvider = this.providers[this.currentProviderIndex];
      this.currentProviderIndex = bestIndex;
      this.logger.warn(`Rotated LLM: ${oldProvider.provider} (${oldProvider.failureCount} failures) → ${bestProvider.provider} (${bestProvider.failureCount} failures)`);
    }
  }

  getCurrentProvider(): LLMProvider {
    return this.providers[this.currentProviderIndex] || this.providers[0];
  }

  getStatus() {
    return this.providers.map((p) => ({
      provider: p.provider,
      healthy: p.failureCount < 3,
      failureCount: p.failureCount,
      lastTestedAt: p.lastTestedAt,
      isCurrent: this.providers.indexOf(p) === this.currentProviderIndex,
    }));
  }
}
