import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  KhojQueryOpts, KhojQueryResponse, KhojMemory,
  KhojAgentConfig, KhojAgent, KhojAutomationConfig, KhojAutomation,
  ResearchResult, ContentType,
} from './khoj-client.types';
import { KHOJ_API_PATHS, KHOJ_CONFIG_KEY, KhojConfig } from './khoj-client.constants';

@Injectable()
export class KhojClientService {
  private readonly logger = new Logger(KhojClientService.name);
  private readonly config: KhojConfig;
  private readonly baseHeaders: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get<KhojConfig>(KHOJ_CONFIG_KEY) || {
      baseUrl: 'http://localhost:42111',
      timeout: 30000,
    };
    this.baseHeaders = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      this.baseHeaders['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers = { ...this.baseHeaders, ...options.headers };
      if (options.body instanceof FormData) {
        delete headers['Content-Type'];
      }
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Khoj API error ${response.status} on ${path}: ${body}`);
      }

      if (response.status === 204) return undefined as T;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return (await response.text()) as unknown as T;
      }
      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<boolean> {
    try {
      await this.request<{ status: string }>(KHOJ_API_PATHS.health);
      return true;
    } catch (err) {
      this.logger.warn(`Khoj health check failed: ${err}`);
      return false;
    }
  }

  async query(question: string, opts?: KhojQueryOpts): Promise<KhojQueryResponse> {
    return this.request<KhojQueryResponse>(KHOJ_API_PATHS.chat, {
      method: 'POST',
      body: JSON.stringify({ q: question, ...opts }),
    });
  }

  async search(query: string): Promise<any> {
    return this.request<any>(`${KHOJ_API_PATHS.search}?q=${encodeURIComponent(query)}`);
  }

  async ingest(file: Buffer, filename: string, type: ContentType): Promise<void> {
    const mime = type === 'markdown' ? 'text/markdown' : 'text/plain';
    const formData = new FormData();
    const blob = new Blob([file as unknown as BlobPart], { type: mime });
    formData.append('files', blob, filename);

    await this.request(`${KHOJ_API_PATHS.content}?t=${type}`, {
      method: 'PUT',
      body: formData,
      headers: {}, // Let fetch set Content-Type for FormData
    });
  }

  private async uploadText(content: string, filename: string): Promise<void> {
    const formData = new FormData();
    formData.append('files', new Blob([content], { type: 'text/markdown' }), filename);

    await this.request(`${KHOJ_API_PATHS.content}?t=markdown`, {
      method: 'PUT',
      body: formData,
      headers: {}, // Let fetch set Content-Type for FormData
    });
  }

  async ingestText(content: string, type: ContentType = 'plaintext'): Promise<void> {
    const ext = type === 'markdown' ? 'md' : 'txt';
    await this.uploadText(content, `crm-knowledge-${randomUUID()}.${ext}`);
  }

  async getMemories(): Promise<KhojMemory[]> {
    return this.request<KhojMemory[]>(KHOJ_API_PATHS.memories);
  }

  async saveMemory(raw: string): Promise<void> {
    await this.uploadText(raw, `memory-${randomUUID()}.md`);
  }

  async deleteMemory(memoryId: number): Promise<void> {
    await this.request(`${KHOJ_API_PATHS.memories}/${memoryId}`, { method: 'DELETE' });
  }

  async createAgent(config: KhojAgentConfig): Promise<KhojAgent> {
    return this.request<KhojAgent>(KHOJ_API_PATHS.agents, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async listAgents(): Promise<KhojAgent[]> {
    return this.request<KhojAgent[]>(KHOJ_API_PATHS.agents);
  }

  async getAgent(slug: string): Promise<KhojAgent> {
    return this.request<KhojAgent>(`${KHOJ_API_PATHS.agents}/${slug}`);
  }

  async deleteAgent(slug: string): Promise<void> {
    await this.request(`${KHOJ_API_PATHS.agents}/${slug}`, { method: 'DELETE' });
  }

  async createAutomation(config: KhojAutomationConfig): Promise<KhojAutomation> {
    return this.request<KhojAutomation>(KHOJ_API_PATHS.automation, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async listAutomations(): Promise<KhojAutomation[]> {
    return this.request<KhojAutomation[]>(KHOJ_API_PATHS.automation);
  }

  async deleteAutomation(automationId: string): Promise<void> {
    await this.request(`${KHOJ_API_PATHS.automation}/${automationId}`, { method: 'DELETE' });
  }

  async deepResearch(query: string): Promise<ResearchResult> {
    return this.request<ResearchResult>(`${KHOJ_API_PATHS.chat}/research`, {
      method: 'POST',
      body: JSON.stringify({ q: query, deep: true }),
    });
  }
}
