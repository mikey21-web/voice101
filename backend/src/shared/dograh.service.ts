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

/**
 * Turn-taking settings sent with every workflow publish. These decide when the agent believes
 * you have stopped speaking, which matters far more to whether a call feels human than the voice
 * or the prompt does. We previously shipped Dograh's stock defaults, which are tuned for English
 * on a clean line — on an 8kHz Indian phone line with Telugu fillers ('అ..', 'మ్మ్') the 2s stop
 * window reads as the agent being slow to respond.
 *
 * Calibrated toward Outpero's ~300ms endpointing: 0.4s stop detection makes pauses feel human
 * instead of stiff. Going below ~0.3s risks the agent cutting callers off mid-word on noisy lines.
 *
 * ponytail: these are a starting point, not a truth. Calibrate against real call recordings —
 * raise smart_turn_stop_secs if the agent starts talking over people, lower it if it feels slow.
 */
const TURN_TAKING = {
  smart_turn_stop_secs: 0.4,
  max_user_idle_timeout: 8,
  turn_start_strategy: 'default',
  turn_stop_strategy: 'transcription',
  context_compaction_enabled: true,
  max_call_duration: 600,
};

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
      body: JSON.stringify({ name, workflow_definition: definition, workflow_configurations: TURN_TAKING }),
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

  /**
   * One-time migration read: the raw, currently-live globalNode prompt, used ONLY to seed a
   * tenant's stored rawPersona the first time getSettings runs after this refactor. Never used
   * on the normal read/write path — see getWorkflowMeta / setGlobalPrompt.
   */
  async getRawGlobalPrompt(language = 'te'): Promise<string> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { definition } = await this.fetchWorkflowDefinition(workflowId);
    const globalNode = definition.nodes.find((n: any) => n.type === 'globalNode');
    return globalNode?.data?.prompt || '';
  }

  /**
   * Reads only what genuinely lives in Dograh's own workflow state: greeting text, whether AMD
   * is on, and the end-call checklist copy (a fixed, non-compounding template — see
   * updateChecklistCopy). The composed globalNode prompt (persona + safety + style layer) is NOT
   * parsed back out here — that text is a build artifact, not a source of truth. The caller
   * (VoiceAgentService) owns the raw persona and toggles and reconstructs the prompt from them.
   * Parsing state back out of previously-generated text is exactly what caused settings to
   * silently compound on every save; see setGlobalPrompt below.
   */
  async getWorkflowMeta(language = 'te'): Promise<{ greeting: string; voicemailDetectionEnabled: boolean; checklistCopy: string }> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { definition } = await this.fetchWorkflowDefinition(workflowId);
    const startNode = definition.nodes.find((n: any) => n.type === 'startCall');
    const endCallNodes = definition.nodes.filter((n: any) => n.type === 'endCall');
    const checklistCopy = endCallNodes.length > 0 && endCallNodes[0].data?.prompt?.includes('Before saying goodbye')
      ? endCallNodes[0].data.prompt
      : '';
    return {
      greeting: startNode?.data?.greeting || '',
      voicemailDetectionEnabled: await this.getAmdEnabled(),
      checklistCopy,
    };
  }

  async updateGreeting(language: string, greeting: string): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const startNode = definition.nodes.find((n: any) => n.type === 'startCall');
    if (startNode) startNode.data.greeting = greeting;
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  /**
   * Replaces the globalNode prompt outright with an already-composed string (built by
   * composeGlobalPrompt in style-pack.ts). No parsing, no append, no substring matching —
   * every publish is a clean overwrite from the caller's source of truth, so repeated saves
   * can never compound duplicate guard text into the live prompt.
   */
  async setGlobalPrompt(language: string, composedPrompt: string): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const globalNode = definition.nodes.find((n: any) => n.type === 'globalNode');
    if (globalNode) globalNode.data.prompt = composedPrompt;
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  async updateChecklistCopy(language: string, checklistCopy: string): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const endCallNodes = definition.nodes.filter((n: any) => n.type === 'endCall');
    const marker = 'Before saying goodbye';
    const defaultChecklist = ` ${marker}: (1) confirm the caller has no more questions, (2) give them one clear summary line of what happens next, (3) then say goodbye.`;
    for (const node of endCallNodes) {
      const existing: string = node.data.prompt || '';
      const withoutChecklist = existing.includes(marker)
        ? existing.replace(new RegExp(`\\s*${marker}[^]*$`), '')
        : existing;
      node.data.prompt = checklistCopy ? withoutChecklist + defaultChecklist : withoutChecklist;
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
      /** Explicit Dograh workflow id — used by VoiceCampaignService for a specific
       * VoiceEmployee's own compiled workflow, bypassing the language-keyed single-workflow
       * lookup entirely (that lookup only ever made sense for the original one-employee-per-
       * language system). */
      workflowIdOverride?: string;
    },
  ): Promise<{ campaignId: number }> {
    const workflowId = options?.workflowIdOverride || WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
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

  /**
   * Real API keys used to talk to each TTS/STT/LLM provider on Dograh's behalf. Sourced from
   * OUR OWN backend env, never from Dograh — Dograh's GET on model-configurations/v2 returns
   * api_key masked (e.g. "********************************IRBy") for exactly the reason this
   * matters: it must never be readable back over the API. Round-tripping that masked string
   * into a later PUT would silently overwrite the real, working credential with asterisks and
   * take down the live TTS pipeline. See setTtsVoice below.
   */
  private providerApiKey(provider: string): string {
    const key = this.config.get<string>(`${provider.toUpperCase()}_API_KEY`, '');
    if (!key) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured on this server — add it before changing the ${provider} voice.`);
    return key;
  }

  /** Voice catalogue for a provider (e.g. sarvam, cartesia, elevenlabs) — read-only, no credentials at risk. */
  async listVoices(provider: string, language?: string): Promise<Array<{ voice_id: string; name: string; gender: string | null; accent: string | null }>> {
    const q = language ? `?language=${encodeURIComponent(language)}` : '';
    const res = await fetch(`${this.baseUrl}/api/v1/user/configurations/voices/${provider}${q}`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh list voices failed: ${await res.text()}`);
    const data = await res.json();
    return data.voices || [];
  }

  /** The live LLM/TTS/STT configuration, with provider api_keys masked by Dograh itself. Display-only. */
  async getModelConfiguration(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/organizations/model-configurations/v2`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh get model configuration failed: ${await res.text()}`);
    return (await res.json()).effective_configuration;
  }

  /**
   * Switches the TTS voice/speed, optionally the provider. Fetches the current full pipeline
   * config first so llm/stt are carried over unchanged, replaces ONLY the tts block, and fills
   * in the real api_key from our own env (never the masked value from the GET response) —
   * this is the one write path in this file where getting that wrong breaks live calls, so it
   * is deliberately its own method rather than a generic "patch config" helper.
   */
  async setTtsVoice(provider: string, voiceId: string, speed?: number, language?: string): Promise<void> {
    const apiKey = this.providerApiKey(provider);
    const res = await fetch(`${this.baseUrl}/api/v1/organizations/model-configurations/v2`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh get model configuration failed: ${await res.text()}`);
    const current = (await res.json()).configuration;
    if (current?.mode !== 'byok' || !current.byok?.pipeline) {
      throw new Error('Voice switching is only supported in BYOK pipeline mode; current org configuration is not in that mode.');
    }

    const previousTts = current.byok.pipeline.tts || {};
    current.byok.pipeline.tts = {
      provider,
      api_key: apiKey,
      model: previousTts.provider === provider ? previousTts.model : undefined,
      voice: voiceId,
      language: language ?? previousTts.language ?? 'te-IN',
      speed: speed ?? previousTts.speed ?? 1,
    };

    const putRes = await fetch(`${this.baseUrl}/api/v1/organizations/model-configurations/v2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify(current),
    });
    if (!putRes.ok) throw new Error(`Dograh set TTS voice failed: ${await putRes.text()}`);
  }

  /** Switches the STT provider/model/language, carrying llm and tts over unchanged. Same
   * read-full-config → replace-stt-block → PUT discipline as setTtsVoice. */
  async setStt(provider: string, model: string, language?: string): Promise<void> {
    const apiKey = this.providerApiKey(provider);
    const res = await fetch(`${this.baseUrl}/api/v1/organizations/model-configurations/v2`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dograh get model configuration failed: ${await res.text()}`);
    const current = (await res.json()).configuration;
    if (current?.mode !== 'byok' || !current.byok?.pipeline) {
      throw new Error('STT switching is only supported in BYOK pipeline mode; current org configuration is not in that mode.');
    }

    current.byok.pipeline.stt = {
      provider,
      api_key: apiKey,
      model,
      ...(language ? { language } : {}),
    };

    const putRes = await fetch(`${this.baseUrl}/api/v1/organizations/model-configurations/v2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify(current),
    });
    if (!putRes.ok) throw new Error(`Dograh set STT failed: ${await putRes.text()}`);
  }

  /** Presigned URL for the owner to upload their own background-noise clip (max 10MB per Dograh's schema). No credentials involved — safe to call freely, unlike setTtsVoice. */
  async getAmbientNoiseUploadUrl(language: string, filename: string, fileSize: number, mimeType = 'audio/wav'): Promise<{ uploadUrl: string; storageKey: string }> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/ambient-noise/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ workflow_id: Number(workflowId), filename, file_size: fileSize, mime_type: mimeType }),
    });
    if (!res.ok) throw new Error(`Dograh ambient-noise upload URL failed: ${await res.text()}`);
    const data = await res.json();
    return { uploadUrl: data.upload_url, storageKey: data.storage_key };
  }

  /** Toggles ambient background noise and/or points it at a previously-uploaded clip. Passing
   * storageKey undefined leaves whatever clip is already configured untouched. */
  async setAmbientNoise(language: string, changes: { enabled?: boolean; volume?: number; storageKey?: string }): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const { name, definition } = await this.fetchWorkflowDefinition(workflowId);
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/fetch/${workflowId}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh fetch workflow failed: ${await res.text()}`);
    const wf = await res.json();
    const current = wf.workflow_configurations || {};
    const ambient = current.ambient_noise_configuration || { enabled: false, volume: 0.3 };

    current.ambient_noise_configuration = {
      ...ambient,
      enabled: changes.enabled ?? ambient.enabled,
      volume: changes.volume ?? ambient.volume,
      ...(changes.storageKey ? { storage_key: changes.storageKey } : {}),
    };

    const putRes = await fetch(`${this.baseUrl}/api/v1/workflow/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ name, workflow_definition: definition, workflow_configurations: current }),
    });
    if (!putRes.ok) throw new Error(`Dograh set ambient noise failed: ${await putRes.text()}`);
    // Config-only change to a published workflow's siblings doesn't need a re-publish call in
    // Dograh's model (workflow_configurations lives outside workflow_definition versioning),
    // but publishing is cheap and guarantees the change is live rather than draft.
    await fetch(`${this.baseUrl}/api/v1/workflow/${workflowId}/publish`, { method: 'POST', headers: { 'X-API-Key': this.apiKey } }).catch(() => {});
  }

  async getAmbientNoise(language: string): Promise<{ enabled: boolean; volume: number; storageKey: string | null }> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/fetch/${workflowId}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh fetch workflow failed: ${await res.text()}`);
    const wf = await res.json();
    const ambient = wf.workflow_configurations?.ambient_noise_configuration || {};
    return { enabled: !!ambient.enabled, volume: ambient.volume ?? 0.3, storageKey: ambient.storage_key ?? null };
  }

  /**
   * Deterministically builds a full call-flow node/edge graph from an AI-generated draft (see
   * CallFlowGeneratorService) and publishes it, replacing the workflow's conversational nodes.
   * The LLM only ever supplies plain text (persona/greeting/step prompts/outcome conditions) —
   * this method owns every structural detail: node ids, edge wiring, and three boilerplate
   * safety nodes that are never LLM-authored:
   *   - wrong-number/busy routing off the greeting's call_status extraction
   *   - voicemail routing off Twilio AMD's answered_by field
   *   - a human-handoff endCall wired from EVERY conversational node, gated on a wants_human
   *     extraction variable injected into every node regardless of what the draft specified
   * This mirrors the exact pattern already proven in workflow-build/add-human-handoff.mjs and
   * add-voicemail-node.mjs — same node shapes, same edge conventions, so a generated flow looks
   * structurally identical to the hand-built one already live in production.
   *
   * The webhook node (post-call outcome delivery) is preserved byte-for-byte from whatever is
   * currently live — its secret and endpoint are never touched — but its payload_template gets
   * new `{{gathered_context.<var>}}` passthrough entries added for every variable this draft's
   * steps extract, so nothing the new flow captures is silently dropped from the outbound
   * webhook. Downstream consumers of that webhook (e.g. LeadOrchestratorService) still only
   * understand the specific field names the real-estate flow uses today — teaching that service
   * to interpret arbitrary generated fields is a separate piece of work, not done here.
   *
   * composedPersona must already be fully composed (safety rules + style pack etc. applied) by
   * the caller — this method never mutates or re-derives it, same discipline as setGlobalPrompt.
   */
  async applyGeneratedFlow(
    language: string,
    composedPersona: string,
    draft: {
      greeting: string;
      steps: Array<{ key: string; label: string; prompt: string; extract: Array<{ name: string; type: string; prompt: string }> }>;
      outcomes: Array<{ key: string; label: string; condition: string; closingPrompt: string }>;
    },
  ): Promise<void> {
    const workflowId = WORKFLOW_ID_BY_LANGUAGE[language] || WORKFLOW_ID_BY_LANGUAGE.te;
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/fetch/${workflowId}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh fetch workflow failed: ${await res.text()}`);
    const wf = await res.json();
    const oldDef = wf.workflow_definition;

    const webhookNode = oldDef.nodes.find((n: any) => n.type === 'webhook');

    let nextId = 1;
    const id = () => String(nextId++);
    const pos = { x: 0, y: 0 };
    const WANTS_HUMAN_VAR = { name: 'wants_human', type: 'boolean', prompt: 'The caller explicitly asked to speak with a human agent or a real person instead of continuing with the AI.' };

    const nodes: any[] = [];
    const edges: any[] = [];

    const globalNode = { id: id(), type: 'globalNode', position: pos, data: { name: 'persona', prompt: composedPersona } };
    nodes.push(globalNode);

    const greetingNode = {
      id: id(), type: 'startCall', position: pos,
      data: {
        name: 'greeting', greeting_type: 'text', greeting: draft.greeting,
        prompt: "Confirm they are the right person and have a couple of minutes. If wrong number, acknowledge and prepare to end the call politely. If busy, offer to call back later and prepare to end the call politely. If they confirm interest and have time, move on.",
        allow_interrupt: false, add_global_prompt: true, delayed_start: false, delayed_start_duration: 2,
        extraction_enabled: true,
        extraction_variables: [{ name: 'call_status', type: 'string', prompt: "one of: 'interested', 'busy', 'wrong_number'" }, WANTS_HUMAN_VAR],
        pre_call_fetch_enabled: false,
      },
    };
    nodes.push(greetingNode);

    const stepNodes = draft.steps.map((step) => {
      const node = {
        id: id(), type: 'agentNode', position: pos,
        data: {
          name: step.key, prompt: step.prompt, allow_interrupt: true, add_global_prompt: true,
          extraction_enabled: true,
          extraction_variables: [...step.extract.map((v) => ({ name: v.name, type: v.type, prompt: v.prompt })), WANTS_HUMAN_VAR],
        },
      };
      nodes.push(node);
      return node;
    });

    const outcomeNodes = draft.outcomes.map((o) => {
      const node = {
        id: id(), type: 'endCall', position: pos,
        data: { name: o.key, prompt: `${o.closingPrompt} Before saying goodbye: (1) confirm the caller has no more questions, (2) give them one clear summary line of what happens next, (3) then say goodbye.`, add_global_prompt: true, extraction_enabled: false },
      };
      nodes.push(node);
      return node;
    });

    const wrongNumberNode = { id: id(), type: 'endCall', position: pos, data: { name: 'wrong_number_or_busy', prompt: 'If wrong number, apologize briefly and end the call. If busy, confirm you will call back later and end the call politely.', add_global_prompt: true, extraction_enabled: false } };
    nodes.push(wrongNumberNode);

    const voicemailNode = { id: id(), type: 'endCall', position: pos, data: { name: 'voicemail', prompt: 'Leave a brief, friendly message mentioning why you called and that the team will try again later. Keep it under 10 seconds worth of speech.', add_global_prompt: false } };
    nodes.push(voicemailNode);

    const humanHandoffNode = { id: id(), type: 'endCall', position: pos, data: { name: 'human_handoff', prompt: "Acknowledge warmly and let them know a team member will call them back shortly. Don't argue or continue qualifying.", add_global_prompt: false } };
    nodes.push(humanHandoffNode);

    if (webhookNode) nodes.push(webhookNode);

    // Wiring: greeting -> first step (on 'interested'); linear chain through steps; last step ->
    // each outcome (LLM-authored condition); greeting -> wrong-number/voicemail off telephony
    // signals; every conversational node -> human handoff, gated on the injected wants_human var.
    edges.push({ id: `${greetingNode.id}-${stepNodes[0]?.id}`, source: greetingNode.id, target: stepNodes[0]?.id, data: { label: 'interested', condition: "call_status is 'interested'" } });
    edges.push({ id: `${greetingNode.id}-${wrongNumberNode.id}`, source: greetingNode.id, target: wrongNumberNode.id, data: { label: 'busy_or_wrong_number', condition: "call_status is 'busy' or 'wrong_number'" } });
    edges.push({ id: `${greetingNode.id}-${voicemailNode.id}`, source: greetingNode.id, target: voicemailNode.id, data: { label: 'voicemail', condition: "answered_by is 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', or 'fax'" } });

    for (let i = 0; i < stepNodes.length - 1; i++) {
      edges.push({ id: `${stepNodes[i].id}-${stepNodes[i + 1].id}`, source: stepNodes[i].id, target: stepNodes[i + 1].id, data: { label: 'next', condition: `${draft.steps[i].label} captured.` } });
    }
    const lastStep = stepNodes[stepNodes.length - 1];
    draft.outcomes.forEach((o, i) => {
      edges.push({ id: `${lastStep.id}-${outcomeNodes[i].id}`, source: lastStep.id, target: outcomeNodes[i].id, data: { label: o.label, condition: o.condition } });
    });

    for (const node of [greetingNode, ...stepNodes]) {
      edges.push({ id: `${node.id}-${humanHandoffNode.id}-human`, source: node.id, target: humanHandoffNode.id, data: { label: 'wants human', condition: 'wants_human is true' } });
    }

    if (webhookNode?.data?.payload_template?.outcome) {
      for (const step of draft.steps) {
        for (const v of step.extract) {
          if (!(v.name in webhookNode.data.payload_template.outcome)) {
            webhookNode.data.payload_template.outcome[v.name] = `{{gathered_context.${v.name}}}`;
          }
        }
      }
    }

    const newDefinition = { nodes, edges, viewport: oldDef.viewport };
    await this.saveAndPublishWorkflow(workflowId, wf.name, newDefinition);
  }

  /**
   * Creates a brand-new Dograh workflow from a full definition — used the first time a
   * VoiceEmployee is published. Subsequent publishes reuse the returned id and go through
   * publishEmployeeWorkflow instead, so an employee always compiles to the same underlying
   * workflow rather than accumulating orphaned ones.
   */
  async createWorkflow(name: string, definition: any): Promise<{ id: string; uuid: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/create/definition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: JSON.stringify({ name, workflow_definition: definition }),
    });
    if (!res.ok) throw new Error(`Dograh create workflow failed: ${await res.text()}`);
    const data = await res.json();
    // create/definition alone doesn't leave a publishable draft — confirmed empirically,
    // publish immediately after create fails with "No draft to publish". A PUT establishes
    // the draft version (same PUT-then-publish sequence every other write path in this file
    // already uses), so redo it here even though the content is identical to what create
    // just wrote.
    await this.saveAndPublishWorkflow(String(data.id), name, definition);
    // workflow_uuid on the create/definition response is unset at that point (confirmed
    // empirically — it's only assigned once the workflow is genuinely published, which just
    // happened above) — re-fetch rather than trust the stale value from the create response.
    const { uuid } = await this.getWorkflowUuid(String(data.id));
    return { id: String(data.id), uuid };
  }

  private async getWorkflowUuid(workflowId: string): Promise<{ uuid: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/workflow/fetch/${workflowId}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`Dograh fetch workflow (for uuid) failed: ${await res.text()}`);
    const data = await res.json();
    return { uuid: data.workflow_uuid };
  }

  /** Overwrites and republishes an already-created workflow — the update path for a
   * VoiceEmployee that already has a dograhWorkflowId. */
  async publishWorkflowDefinition(workflowId: string, name: string, definition: any): Promise<void> {
    await this.saveAndPublishWorkflow(workflowId, name, definition);
  }

  /**
   * Compiles a VoiceEmployee's section graph into a Dograh workflow_definition. Follows the
   * exact node/edge conventions proven in applyGeneratedFlow above (id scheme, wrongNumber/
   * voicemail telephony-signal branches off the greeting, a wants_human escalation edge on
   * every conversational node) but is driven by the section graph's OWN edges — each section
   * already carries {to_key, condition} pairs (see VoiceEmployeeSection), so branching is
   * whatever the employee's own graph specifies rather than an auto-chained linear list.
   */
  compileEmployeeDefinition(employee: {
    employeeId: string;
    composedPersona: string;
    greeting: string;
    sections: Array<{ sectionKey: string; label: string; prompt: string; enabled: boolean; order: number; nodeType: string; edges: Array<{ to_key: string; condition: string }> }>;
    variables: Array<{ key: string; label: string; source: string; required: boolean; extractHint: string | null }>;
    outboundWebhookUrl?: string;
    webhookSecretHeader?: string;
  }): any {
    let nextId = 1;
    const id = () => String(nextId++);
    const pos = { x: 0, y: 0 };
    const WANTS_HUMAN_VAR = { name: 'wants_human', type: 'boolean', prompt: 'The caller explicitly asked to speak with a human agent or a real person instead of continuing with the AI.' };

    const nodes: any[] = [];
    const edges: any[] = [];

    const globalNode = { id: id(), type: 'globalNode', position: pos, data: { name: 'persona', prompt: employee.composedPersona } };
    nodes.push(globalNode);

    const greetingNode = {
      id: id(), type: 'startCall', position: pos,
      data: {
        name: 'greeting', greeting_type: 'text', greeting: employee.greeting,
        prompt: 'Confirm they are the right person and have a couple of minutes. If wrong number, acknowledge and prepare to end the call politely. If busy, offer to call back later and prepare to end the call politely. If they confirm interest and have time, move on.',
        allow_interrupt: false, add_global_prompt: true, delayed_start: false, delayed_start_duration: 2,
        extraction_enabled: true,
        extraction_variables: [{ name: 'call_status', type: 'string', prompt: "one of: 'interested', 'busy', 'wrong_number'" }, WANTS_HUMAN_VAR],
        pre_call_fetch_enabled: false,
      },
    };
    nodes.push(greetingNode);

    const wrongNumberNode = { id: id(), type: 'endCall', position: pos, data: { name: 'wrong_number_or_busy', prompt: 'If wrong number, apologize briefly and end the call. If busy, confirm you will call back later and end the call politely.', add_global_prompt: true, extraction_enabled: false } };
    nodes.push(wrongNumberNode);
    const voicemailNode = { id: id(), type: 'endCall', position: pos, data: { name: 'voicemail', prompt: 'Leave a brief, friendly message mentioning why you called and that the team will try again later. Keep it under 10 seconds worth of speech.', add_global_prompt: false } };
    nodes.push(voicemailNode);
    const humanHandoffNode = { id: id(), type: 'endCall', position: pos, data: { name: 'human_handoff', prompt: "Acknowledge warmly and let them know a team member will call them back shortly. Don't argue or continue qualifying.", add_global_prompt: false } };
    nodes.push(humanHandoffNode);

    const captureVars = employee.variables.filter((v) => v.source === 'capture').map((v) => ({ name: v.key, type: 'string', prompt: v.extractHint || v.label }));

    // Every section is a conversational agentNode. Sections used to be compiled to endCall when
    // they had no outgoing edges, which meant a single-section employee (what the hire wizard
    // produces, and the common case) went greeting -> endCall: the agent spoke one line and hung
    // up. An endCall node in Dograh delivers its prompt and terminates, so it can never hold a
    // conversation. Sections with nowhere to go now route to a shared goodbye node instead
    // (wired up below), so the call ends only once the section's own conversation is finished.
    const enabledSections = employee.sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
    const goodbyeNode = { id: id(), type: 'endCall', position: pos, data: { name: 'goodbye', prompt: 'Confirm the caller has no more questions, give one clear line on what happens next, then say goodbye and end the call.', add_global_prompt: true, extraction_enabled: false } };
    nodes.push(goodbyeNode);

    const sectionNodeByKey = new Map<string, any>();
    for (const section of enabledSections) {
      // Dograh validates node.type against a fixed set (globalNode/startCall/agentNode/
      // endCall/webhook). Our own nodeType vocabulary is internal and must never be passed
      // through to it: rows created by the hire wizard carry nodeType 'llm', which Dograh
      // rejects with "unknown node type", failing the whole publish. Every section is
      // conversational, so every section compiles to agentNode; 'faq' only changes the data.
      const isFaq = section.nodeType === 'faq';
      const node = {
        id: id(), type: 'agentNode', position: pos,
        data: {
          name: section.sectionKey,
          prompt: section.prompt,
          allow_interrupt: !isFaq,
          add_global_prompt: true,
          extraction_enabled: !isFaq,
          ...(isFaq && { faq_mode: true, source_type: 'knowledge_base' }),
          extraction_variables: !isFaq ? [...captureVars, WANTS_HUMAN_VAR] : [],
        },
      };
      nodes.push(node);
      sectionNodeByKey.set(section.sectionKey, node);
    }

    // First enabled section is the entry point from a confirmed-interested greeting.
    const firstSection = enabledSections[0];
    if (firstSection) {
      edges.push({ id: `${greetingNode.id}-${sectionNodeByKey.get(firstSection.sectionKey).id}`, source: greetingNode.id, target: sectionNodeByKey.get(firstSection.sectionKey).id, data: { label: 'interested', condition: "call_status is 'interested'" } });
    }
    edges.push({ id: `${greetingNode.id}-${wrongNumberNode.id}`, source: greetingNode.id, target: wrongNumberNode.id, data: { label: 'busy_or_wrong_number', condition: "call_status is 'busy' or 'wrong_number'" } });
    edges.push({ id: `${greetingNode.id}-${voicemailNode.id}`, source: greetingNode.id, target: voicemailNode.id, data: { label: 'voicemail', condition: "answered_by is 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', or 'fax'" } });

    // The section graph's own edges, exactly as authored — this is where real branching
    // (not just a linear chain) comes from. Dograh emits one LLM function per outgoing
    // edge, named after the edge label. A node with several outgoing edges must therefore
    // carry distinct labels, or the model sees the same function declared twice and the
    // whole call fails with "Duplicate function declaration found: <label>". Two conditions
    // that route to the same target (e.g. intent_gate -> qual_config on both 'Own Use' and
    // 'Investment') are merged into one edge with an OR'd condition, and multi-target nodes
    // get a per-target label so every emitted function name is unique.
    for (const section of enabledSections) {
      const fromNode = sectionNodeByKey.get(section.sectionKey);
      const byTarget = new Map<string, string[]>();
      for (const e of section.edges || []) {
        if (!sectionNodeByKey.has(e.to_key)) continue; // dangling reference to a disabled/missing section — skip rather than crash the publish
        const conds = byTarget.get(e.to_key) || [];
        if (e.condition) conds.push(e.condition);
        byTarget.set(e.to_key, conds);
      }
      for (const [toKey, conds] of byTarget) {
        const toNode = sectionNodeByKey.get(toKey);
        const label = byTarget.size > 1 ? `next_to_${toKey}` : 'next';
        edges.push({ id: `${fromNode.id}-${toNode.id}`, source: fromNode.id, target: toNode.id, data: { label, condition: conds.join(' OR ') } });
      }
    }

    // A section with no authored outgoing edge is where the script runs out. It still needs a way
    // out of the graph, or the call dead-ends; route it to the shared goodbye node so the agent
    // finishes the conversation first and only then closes.
    for (const section of enabledSections) {
      if (section.edges?.some((e) => sectionNodeByKey.has(e.to_key))) continue;
      const fromNode = sectionNodeByKey.get(section.sectionKey);
      edges.push({ id: `${fromNode.id}-${goodbyeNode.id}-done`, source: fromNode.id, target: goodbyeNode.id, data: { label: 'done', condition: 'the caller has no further questions and this part of the conversation is complete' } });
    }

    for (const node of [greetingNode, ...enabledSections.map((s) => sectionNodeByKey.get(s.sectionKey))]) {
      edges.push({ id: `${node.id}-${humanHandoffNode.id}-human`, source: node.id, target: humanHandoffNode.id, data: { label: 'wants human', condition: 'wants_human is true' } });
    }

    if (employee.outboundWebhookUrl) {
      const outcomeShape: Record<string, string> = { wants_human: '{{gathered_context.wants_human}}' };
      for (const v of employee.variables) outcomeShape[v.key] = `{{gathered_context.${v.key}}}`;
      // Secret goes on the URL as a query param, not a custom header — confirmed empirically that
      // Dograh's webhook node stores configured custom_headers on the definition but does not
      // actually send them on the real outbound request, so every real call 401'd against our
      // header-only check even though the header was correctly configured. The endpoint_url itself
      // is always sent verbatim, so a query param survives where a header silently didn't.
      const webhookUrl = employee.webhookSecretHeader
        ? `${employee.outboundWebhookUrl}?secret=${encodeURIComponent(employee.webhookSecretHeader)}`
        : employee.outboundWebhookUrl;
      nodes.push({
        id: id(), type: 'webhook', position: pos,
        data: {
          name: 'post_call_outcome', http_method: 'POST', endpoint_url: webhookUrl,
          custom_headers: [],
          payload_template: {
            employee_id: employee.employeeId, call_sid: '{{workflow_run_id}}', lead_id: '{{initial_context.lead_id}}', status: 'completed',
            outcome: outcomeShape,
          },
        },
      });
    }

    return { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
  }
}
