import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** ponytail: hardcoded until more than a couple of languages are live, then move to DB-driven config. */
const WORKFLOW_UUID_BY_LANGUAGE: Record<string, string> = {
  en: process.env.DOGRAH_WORKFLOW_UUID_EN || '',
  te: process.env.DOGRAH_WORKFLOW_UUID_TE || '',
};
const WORKFLOW_ID_BY_LANGUAGE: Record<string, string> = {
  en: process.env.DOGRAH_WORKFLOW_ID_EN || '',
  te: process.env.DOGRAH_WORKFLOW_ID_TE || '',
};
const DEFAULT_TELEPHONY_CONFIG_ID = process.env.DOGRAH_TELEPHONY_CONFIG_ID || '1';

export interface VoiceAgentSettings {
  greeting: string;
  persona: string;
  voicemailDetectionEnabled: boolean;
  antiEarlyHangupEnabled: boolean;
  checklistCopy: string;
}

@Injectable()
export class DograhService {
  private readonly logger = new Logger(DograhService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('DOGRAH_URL', 'http://host.docker.internal:8010');
    this.apiKey = this.config.get<string>('DOGRAH_API_KEY', '');
  }

  workflowUuidFor(language: string): string {
    return WORKFLOW_UUID_BY_LANGUAGE[language] || WORKFLOW_UUID_BY_LANGUAGE.te;
  }

  async triggerCall(workflowUuid: string, phoneNumber: string, initialContext: Record<string, any>): Promise<{ workflow_run_id: number; status: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/public/agent/workflow/${workflowUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ phone_number: phoneNumber, initial_context: initialContext }),
    });
    if (!res.ok) throw new Error(`Dograh trigger call failed: ${await res.text()}`);
    return res.json();
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getWorkflowDefinition(workflowId: string): Promise<{ name: string; definition: any }> {
    return this.fetchWorkflowDefinition(workflowId);
  }

  async updateWorkflowDefinition(workflowId: string, name: string, definition: any): Promise<void> {
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  async setTelephonyAmd(enabled: boolean): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/organizations/telephony-configs/${DEFAULT_TELEPHONY_CONFIG_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ amd_enabled: enabled }),
    });
    if (!res.ok) throw new Error(`Dograh telephony config update failed: ${await res.text()}`);
  }

  private async fetchWorkflowDefinition(workflowId: string): Promise<{ name: string; definition: any }> {
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/fetch/${workflowId}`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh fetch workflow failed: ${await res.text()}`);
    const wf = await res.json();
    return { name: wf.name, definition: wf.workflow_definition };
  }

  private async saveAndPublishWorkflow(workflowId: string, name: string, definition: any): Promise<void> {
    const putRes = await fetch(`${this.baseUrl}/api/v1/workflow/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ name, workflow_definition: definition }),
    });
    if (!putRes.ok) throw new Error(`Dograh update workflow failed: ${await putRes.text()}`);

    const publishRes = await fetch(`${this.baseUrl}/api/v1/workflow/${workflowId}/publish`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!publishRes.ok) throw new Error(`Dograh publish workflow failed: ${await publishRes.text()}`);
  }

  private async getAmdEnabled(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/v1/organizations/telephony-configs/${DEFAULT_TELEPHONY_CONFIG_ID}`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) return false;
    const config = await res.json();
    return Boolean(config?.credentials?.amd_enabled);
  }

  async getSettings(language = 'te'): Promise<VoiceAgentSettings> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { definition } = await this.fetchWorkflowDefinition(workflowId);
    const globalNode = definition.nodes.find((n: any) => n.type === 'globalNode');
    const startNode = definition.nodes.find((n: any) => n.type === 'startCall');
    const endCallNodes = definition.nodes.filter((n: any) => n.type === 'endCall');
    const voicemailDetectionEnabled = await this.getAmdEnabled();
    const antiEarlyHangupEnabled = globalNode?.data?.prompt?.includes('Do not end the call') ?? false;
    const checklistCopy = endCallNodes.length > 0 && endCallNodes[0].data?.prompt?.includes('Before saying goodbye')
      ? endCallNodes[0].data.prompt
      : '';
    return {
      greeting: startNode?.data?.greeting || '',
      persona: globalNode?.data?.prompt || '',
      voicemailDetectionEnabled,
      antiEarlyHangupEnabled,
      checklistCopy,
    };
  }

  async updateSettings(language: string, changes: { greeting?: string; persona?: string; antiEarlyHangupEnabled?: boolean; checklistCopy?: string }): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const globalNode = definition.nodes.find((n: any) => n.type === 'globalNode');
    const startNode = definition.nodes.find((n: any) => n.type === 'startCall');
    const endCallNodes = definition.nodes.filter((n: any) => n.type === 'endCall');
    if (changes.greeting !== undefined && startNode) startNode.data.greeting = changes.greeting;
    if (changes.persona !== undefined && globalNode) globalNode.data.prompt = changes.persona;
    if (changes.antiEarlyHangupEnabled !== undefined && globalNode) {
      const guard = ' Do not end the call or mark the lead as not interested within the first 10 seconds of the conversation unless the caller is clearly hostile or has hung up - a hesitant "who is this?" or a slow start is not a reason to give up on the call.';
      if (changes.antiEarlyHangupEnabled && !globalNode.data.prompt.includes('Do not end the call')) {
        globalNode.data.prompt += guard;
      } else if (!changes.antiEarlyHangupEnabled) {
        globalNode.data.prompt = globalNode.data.prompt.replace(guard, '');
      }
    }
    if (changes.checklistCopy !== undefined) {
      for (const node of endCallNodes) {
        const existing = node.data.prompt || '';
        const checklist = ' Before saying goodbye: (1) confirm the caller has no more questions, (2) give them one clear summary line of what happens next, (3) then say goodbye.';
        if (changes.checklistCopy) {
          if (!existing.includes('Before saying goodbye')) {
            node.data.prompt = existing + checklist;
          }
        } else {
          node.data.prompt = existing.replace(checklist, '');
        }
      }
    }
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  /** Fields captured by the core qualification flow itself - never shown as removable "custom" fields. */
  private static readonly BUILTIN_FIELDS = ['needs_loan', 'wants_site_visit'];

  async getCustomFields(language = 'te'): Promise<Array<{ name: string; type: string; prompt: string }>> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { definition } = await this.fetchWorkflowDefinition(workflowId);
    const loanNode = definition.nodes.find((n: any) => n.data?.name === 'qualification');
    const vars: Array<{ name: string; type: string; prompt: string }> = loanNode?.data?.extraction_variables || [];
    return vars.filter((v) => !DograhService.BUILTIN_FIELDS.includes(v.name));
  }

  async addCustomField(language: string, field: { name: string; type: 'string' | 'number' | 'boolean'; prompt: string }): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const loanNode = definition.nodes.find((n: any) => n.data?.name === 'qualification');
    if (!loanNode) throw new Error('Could not find the qualification node to attach the field to');
    loanNode.data.extraction_variables = loanNode.data.extraction_variables || [];
    loanNode.data.extraction_variables = loanNode.data.extraction_variables.filter((v: any) => v.name !== field.name);
    loanNode.data.extraction_variables.push(field);
    if (!loanNode.data.prompt.includes(`[custom: ${field.name}]`)) {
      loanNode.data.prompt += ` Also ask: ${field.prompt} [custom: ${field.name}]`;
    }
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  async deleteCustomField(language: string, fieldName: string): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const loanNode = definition.nodes.find((n: any) => n.data?.name === 'qualification');
    if (!loanNode) return;
    loanNode.data.extraction_variables = (loanNode.data.extraction_variables || []).filter((v: any) => v.name !== fieldName);
    loanNode.data.prompt = loanNode.data.prompt.replace(new RegExp(` Also ask:[^\\[]*\\[custom: ${fieldName}\\]`), '');
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  async createCampaignFromCsv(
    name: string,
    language: string,
    csvContent: string,
    options?: {
      maxConcurrency?: number;
      retryConfig?: { enabled: boolean; maxRetries: number; retryDelaySeconds: number; retryOnBusy: boolean; retryOnNoAnswer: boolean; retryOnVoicemail: boolean };
      scheduleConfig?: { enabled: boolean; timezone: string; slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> };
    },
  ): Promise<{ campaignId: number }> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const fileName = `campaign-${Date.now()}.csv`;

    const uploadUrlRes = await fetch(`${this.baseUrl}/api/v1/s3/presigned-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ file_name: fileName, file_size: Buffer.byteLength(csvContent), content_type: 'text/csv' }),
    });
    if (!uploadUrlRes.ok) throw new Error(`Dograh presigned upload URL failed: ${await uploadUrlRes.text()}`);
    const { upload_url: uploadUrl, file_key: fileKey, s3_key: s3Key } = await uploadUrlRes.json();
    const sourceId = fileKey || s3Key;

    const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'text/csv' }, body: csvContent });
    if (!putRes.ok) throw new Error(`CSV upload to Dograh storage failed: ${putRes.status}`);

    const body: Record<string, any> = {
      name,
      workflow_id: parseInt(workflowId, 10),
      source_type: 'csv',
      source_id: sourceId,
      telephony_configuration_id: parseInt(DEFAULT_TELEPHONY_CONFIG_ID, 10),
    };
    if (options?.maxConcurrency) body.max_concurrency = options.maxConcurrency;
    if (options?.retryConfig) {
      body.retry_config = {
        enabled: options.retryConfig.enabled,
        max_retries: options.retryConfig.maxRetries,
        retry_delay_seconds: options.retryConfig.retryDelaySeconds,
        retry_on_busy: options.retryConfig.retryOnBusy,
        retry_on_no_answer: options.retryConfig.retryOnNoAnswer,
        retry_on_voicemail: options.retryConfig.retryOnVoicemail,
      };
    }
    if (options?.scheduleConfig) {
      body.schedule_config = {
        enabled: options.scheduleConfig.enabled,
        timezone: options.scheduleConfig.timezone,
        slots: options.scheduleConfig.slots.map((s) => ({ day_of_week: s.dayOfWeek, start_time: s.startTime, end_time: s.endTime })),
      };
    }

    const createRes = await fetch(`${this.baseUrl}/api/v1/campaign/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) {
      const raw = await createRes.text();
      const detail = (() => { try { return JSON.parse(raw).detail; } catch { return null; } })();
      throw new Error(detail || `Dograh campaign create failed: ${raw}`);
    }
    const campaign = await createRes.json();
    return { campaignId: campaign.id };
  }

  async getCampaignRuns(campaignId: number, page = 1, limit = 50): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/${campaignId}/runs?page=${page}&limit=${limit}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh campaign runs failed: ${await res.text()}`);
    return res.json();
  }

  async getCampaignReportCsv(campaignId: number): Promise<{ buffer: Buffer; contentType: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/${campaignId}/report`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh campaign report failed: ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType: res.headers.get('content-type') || 'text/csv' };
  }

  async getUsageRuns(params: { page?: number; limit?: number; startDate?: string; endDate?: string } = {}): Promise<any> {
    const q = new URLSearchParams();
    q.set('page', String(params.page || 1));
    q.set('limit', String(params.limit || 50));
    if (params.startDate) q.set('start_date', params.startDate);
    if (params.endDate) q.set('end_date', params.endDate);
    const res = await fetch(`${this.baseUrl}/api/v1/organizations/usage/runs?${q}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh usage runs failed: ${await res.text()}`);
    return res.json();
  }

  async startCampaign(campaignId: number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/${campaignId}/start`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh campaign start failed: ${await res.text()}`);
    return res.json();
  }

  async pauseCampaign(campaignId: number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/${campaignId}/pause`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh campaign pause failed: ${await res.text()}`);
    return res.json();
  }

  async resumeCampaign(campaignId: number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/${campaignId}/resume`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh campaign resume failed: ${await res.text()}`);
    return res.json();
  }

  async listCampaigns(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh campaign list failed: ${await res.text()}`);
    return res.json();
  }

  async getCampaignProgress(campaignId: number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/campaign/${campaignId}/progress`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh campaign progress failed: ${await res.text()}`);
    return res.json();
  }

  async uploadKnowledgeBaseDocument(filename: string, mimeType: string, buffer: Buffer): Promise<any> {
    const uploadUrlRes = await fetch(`${this.baseUrl}/api/v1/knowledge-base/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ filename, mime_type: mimeType }),
    });
    if (!uploadUrlRes.ok) throw new Error(`Dograh KB upload URL failed: ${await uploadUrlRes.text()}`);
    const { upload_url: uploadUrl, document_uuid: documentUuid, s3_key: s3Key } = await uploadUrlRes.json();

    const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: new Uint8Array(buffer) });
    if (!putRes.ok) throw new Error(`KB document upload to storage failed: ${putRes.status}`);

    const processRes = await fetch(`${this.baseUrl}/api/v1/knowledge-base/process-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ document_uuid: documentUuid, s3_key: s3Key, retrieval_mode: 'chunked' }),
    });
    if (!processRes.ok) throw new Error(`Dograh KB process-document failed: ${await processRes.text()}`);
    return processRes.json();
  }

  async listKnowledgeBaseDocuments(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/knowledge-base/documents`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh KB documents list failed: ${await res.text()}`);
    return res.json();
  }

  async deleteKnowledgeBaseDocument(documentUuid: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/knowledge-base/documents/${documentUuid}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh KB document delete failed: ${await res.text()}`);
    // Detach from every language's workflow so stale references don't linger.
    for (const language of Object.keys(WORKFLOW_ID_BY_LANGUAGE)) {
      await this.setWorkflowKnowledgeBase(language, documentUuid, false).catch(() => {});
    }
  }

  /** Attaches (or detaches) a knowledge-base document to every conversational node so RAG search works regardless of which step the caller is on. */
  async setWorkflowKnowledgeBase(language: string, documentUuid: string, attach: boolean): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    if (!workflowId) return;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    for (const node of definition.nodes) {
      if (node.type !== 'agentNode' && node.type !== 'startCall') continue;
      const current: string[] = node.data.document_uuids || [];
      node.data.document_uuids = attach
        ? Array.from(new Set([...current, documentUuid]))
        : current.filter((id) => id !== documentUuid);
    }
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }
}
