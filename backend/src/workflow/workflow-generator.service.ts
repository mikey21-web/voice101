import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { WorkflowService } from './workflow.service';

@Injectable()
export class WorkflowGeneratorService {
  private readonly logger = new Logger(WorkflowGeneratorService.name);
  private client: OpenAI | undefined;

  constructor(
    private config: ConfigService,
    private workflowService: WorkflowService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY') || this.config.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL') || this.config.get<string>('DEEPSEEK_BASE_URL');
    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL: baseURL || undefined, timeout: 30000, maxRetries: 1 });
    }
  }

  async generate(prompt: string, tenantId: string) {
    if (!this.client) throw new Error('AI API key not configured');

    const systemPrompt = `You generate CRM workflow definitions in JSON. The user describes what they want in plain English. You output a JSON object with this exact structure:

{
  "name": "Short descriptive name",
  "description": "What this workflow does",
  "trigger": {
    "type": "DB_EVENT",
    "config": {
      "event": "lead.created" | "lead.status_changed" | "lead.assigned" | "form.submitted" | "message.received",
      "filters": {}
    }
  },
  "steps": [
    {
      "stepKey": "step_1",
      "actionType": "SEND_MESSAGE" | "UPDATE_LEAD_STATUS" | "CREATE_TASK" | "SEND_EMAIL" | "SEND_WHATSAPP_TEMPLATE" | "HTTP_REQUEST" | "DELAY" | "CONDITION" | "CREATE_RECORD" | "UPDATE_RECORD",
      "label": "Human readable label",
      "config": {}
    }
  ],
  "edges": [
    { "sourceKey": "step_1", "targetKey": "step_2" }
  ]
}

Available trigger types: DB_EVENT (database events), CRON (scheduled), WEBHOOK (external call), MANUAL (manual trigger)
Available action types: SEND_MESSAGE, UPDATE_LEAD_STATUS, CREATE_TASK, SEND_EMAIL, SEND_WHATSAPP_TEMPLATE, HTTP_REQUEST, DELAY, CONDITION, CREATE_RECORD, UPDATE_RECORD

For SEND_MESSAGE, config should have: { "channel": "WHATSAPP" | "EMAIL" | "SMS", "template": "message text or template name" }
For UPDATE_LEAD_STATUS, config: { "status": "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST" | "COLD" }
For CREATE_TASK, config: { "title": "task title", "description": "description", "dueInDays": 1, "priority": "HIGH" | "MEDIUM" | "LOW" }
For DELAY, config: { "duration": 3600 } (in seconds)
For SEND_EMAIL, config: { "subject": "...", "body": "..." }
For HTTP_REQUEST, config: { "url": "...", "method": "POST", "headers": {}, "body": {} }
For CONDITION, config: { "field": "lead.score", "operator": "greater_than", "value": "80" }

Return ONLY valid JSON, no explanation or markdown.`;

    const response = await this.client.chat.completions.create({
      model: this.config.get<string>('WORKFLOW_MODEL') || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('AI returned empty response');

    const parsed = JSON.parse(text);
    const steps = parsed.steps || [];
    const edges = parsed.edges || [];
    const trigger = parsed.trigger;

    const workflow = await this.workflowService.create({
      name: parsed.name || prompt.slice(0, 60),
      tenantId,
      tags: ['generated'],
    });

    await this.workflowService.createVersion(
      workflow.id,
      steps,
      edges,
      trigger ? [trigger] : [],
    );

    return this.workflowService.findOne(workflow.id, tenantId);
  }
}
