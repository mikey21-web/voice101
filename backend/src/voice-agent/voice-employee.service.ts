import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DograhService } from '../shared/dograh.service';
import { ConfigService } from '@nestjs/config';
import { composeGlobalPrompt } from './style-pack';
import { CallFlowGeneratorService } from './call-flow-generator.service';

/** Spoken verbatim by the TTS, so it has to be written in the employee's own language.
 * Falls back to English for any language we have not written an opener for. */
function defaultGreeting(language: string | null | undefined): string {
  const lang = (language || '').slice(0, 2).toLowerCase();
  if (lang === 'te') return 'నమస్తే అండి! కొంచెం సేపు మాట్లాడొచ్చా?';
  if (lang === 'hi') return 'नमस्ते! क्या दो मिनट बात कर सकते हैं?';
  return 'Hi there! Do you have a minute to talk?';
}

export interface SectionInput {
  sectionKey: string;
  label: string;
  prompt: string;
  enabled?: boolean;
  order: number;
  nodeType?: 'agentNode' | 'faq' | string;
  edges?: Array<{ to_key: string; condition: string }>;
}

export interface VariableInput {
  key: string;
  label: string;
  source?: 'pre' | 'capture';
  required?: boolean;
  extractHint?: string | null;
}

export interface EmployeeInput {
  name: string;
  role: string;
  mode?: string;
  voiceProvider: string;
  voiceId: string;
  voiceName?: string;
  ttsSpeed?: number;
  language?: string;
  extraLanguages?: string[];
  ambientSound?: string | null;
  ambientVolume?: number;
  maxCallDurationS?: number;
  welcomeMessage?: string;
  agentInformation?: string;
  callEndRules?: string;
  scriptAdherence?: number;
  powerPrompting?: boolean;
  stylePackEnabled?: boolean;
  aiAcknowledgementEnabled?: boolean;
  recordingNotice?: boolean;
  sections?: SectionInput[];
  variables?: VariableInput[];
}

/**
 * The core of the voice-agent engine: an AI employee as a versioned, multi-tenant object —
 * identity + voice config + a section graph — that compiles into a live Dograh workflow on
 * publish. Mirrors Outpero's employee model (see REVERSE-ENGINEERED.md), backed by our own
 * Postgres rather than a proprietary store, with Dograh as the execution engine underneath.
 *
 * Draft vs published: edits (create/update) only ever touch our own rows — nothing reaches
 * Dograh until publish() is called. This mirrors Outpero's own is_published/
 * has_unpublished_changes distinction and lets an owner iterate on a script without affecting
 * live calls.
 */
@Injectable()
export class VoiceEmployeeService {
  private readonly logger = new Logger(VoiceEmployeeService.name);

  constructor(
    private prisma: PrismaService,
    private dograh: DograhService,
    private config: ConfigService,
    private generator: CallFlowGeneratorService,
  ) {}

  async list(tenantId: string, includeArchived = false) {
    return this.prisma.voiceEmployee.findMany({
      where: { tenantId, ...(includeArchived ? {} : { deletedAt: null }) },
      orderBy: { createdAt: 'desc' },
      include: { sections: { orderBy: { order: 'asc' } }, variables: true, number: true },
    });
  }

  async get(tenantId: string, id: string) {
    const employee = await this.prisma.voiceEmployee.findFirst({
      where: { id, tenantId },
      include: { sections: { orderBy: { order: 'asc' } }, variables: true, actions: true, deliveries: true, number: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  /** Draft create — no Dograh call yet. Ships with the 5 mid-call action stubs Outpero exposes
   * (gated ones need an integration connected before they can be enabled), matching their
   * captured shape exactly. */
  async create(tenantId: string, input: EmployeeInput) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (!input.voiceProvider || !input.voiceId) throw new BadRequestException('voiceProvider and voiceId are required');

    const employee = await this.prisma.voiceEmployee.create({
      data: {
        tenantId,
        name: input.name,
        role: input.role || '',
        mode: input.mode || 'instant',
        voiceProvider: input.voiceProvider,
        voiceId: input.voiceId,
        voiceName: input.voiceName,
        ttsSpeed: input.ttsSpeed ?? 1,
        language: input.language || 'te-IN',
        extraLanguages: input.extraLanguages || [],
        ambientSound: input.ambientSound ?? null,
        ambientVolume: input.ambientVolume ?? 0,
        maxCallDurationS: input.maxCallDurationS ?? 600,
        welcomeMessage: input.welcomeMessage,
        agentInformation: input.agentInformation,
        callEndRules: input.callEndRules,
        scriptAdherence: input.scriptAdherence ?? 2,
        powerPrompting: input.powerPrompting ?? false,
        stylePackEnabled: input.stylePackEnabled ?? true,
        aiAcknowledgementEnabled: input.aiAcknowledgementEnabled ?? true,
        recordingNotice: input.recordingNotice ?? false,
        hasUnpublishedChanges: true,
        sections: input.sections?.length
          ? { create: input.sections.map((s) => this.sectionCreateData(s)) }
          : undefined,
        variables: input.variables?.length
          ? { create: input.variables.map((v) => this.variableCreateData(v)) }
          : undefined,
        actions: {
          create: [
            { actionKey: 'end_call', label: 'End the call politely when the conversation is done', enabled: false, gated: false },
            { actionKey: 'transfer_call', label: 'Transfer the call to a human teammate', enabled: false, gated: true, gateReason: 'telephony' },
            { actionKey: 'book_appointment', label: 'Book an appointment on a connected calendar', enabled: false, gated: true, gateReason: 'calendar integration' },
            { actionKey: 'send_whatsapp', label: 'Send a WhatsApp message after the call', enabled: false, gated: true, gateReason: 'WhatsApp integration' },
            { actionKey: 'custom_api', label: "Call a custom API you've configured", enabled: false, gated: false },
          ],
        },
      },
      include: { sections: true, variables: true, actions: true },
    });
    this.logger.log(`Employee ${employee.id} ("${employee.name}") created for tenant ${tenantId}`);
    return employee;
  }

  private sectionCreateData(s: SectionInput) {
    return {
      sectionKey: s.sectionKey, label: s.label, prompt: s.prompt,
      enabled: s.enabled ?? true, order: s.order, nodeType: s.nodeType || 'llm', edges: s.edges || [],
    };
  }
  private variableCreateData(v: VariableInput) {
    return { key: v.key, label: v.label, source: v.source || 'capture', required: v.required ?? false, extractHint: v.extractHint ?? null };
  }

  /** Replaces identity/voice/prompt fields and, if provided, the whole section/variable set.
   * Always marks hasUnpublishedChanges — the compiled Dograh workflow is untouched until
   * publish() runs, same as Outpero's draft/publish split. */
  async update(tenantId: string, id: string, input: Partial<EmployeeInput>) {
    await this.get(tenantId, id); // 404s if missing/wrong tenant

    const { sections, variables, ...fields } = input;

    await this.prisma.$transaction(async (tx) => {
      await tx.voiceEmployee.update({
        where: { id },
        data: { ...fields, hasUnpublishedChanges: true },
      });
      if (sections) {
        await tx.voiceEmployeeSection.deleteMany({ where: { employeeId: id } });
        if (sections.length) await tx.voiceEmployeeSection.createMany({ data: sections.map((s) => ({ employeeId: id, ...this.sectionCreateData(s) })) });
      }
      if (variables) {
        await tx.voiceEmployeeVariable.deleteMany({ where: { employeeId: id } });
        if (variables.length) await tx.voiceEmployeeVariable.createMany({ data: variables.map((v) => ({ employeeId: id, ...this.variableCreateData(v) })) });
      }
    });

    return this.get(tenantId, id);
  }

  /** Compiles the current draft into a Dograh workflow and publishes it — creating the
   * underlying workflow on first publish, updating it in place on every publish after that, so
   * an employee always maps to exactly one Dograh workflow rather than accumulating orphans.
   * Snapshots the published state to VoiceEmployeeVersion for restore. */
  async publish(tenantId: string, id: string, publishedById?: string) {
    const employee = await this.get(tenantId, id);
    if (!employee.sections.length) throw new BadRequestException('Employee has no sections to publish');

    const readiness = this.generator.checkReadiness(
      employee.sections.map((s) => ({
        sectionKey: s.sectionKey, label: s.label, prompt: s.prompt, enabled: s.enabled,
        order: s.order, nodeType: s.nodeType, edges: s.edges as any,
      })),
    );
    if (!readiness.canPublish) {
      throw new BadRequestException(`Cannot publish: script not ready (score ${readiness.score}/100). ${readiness.feedback.join(' ')}`);
    }

    const composedPersona = composeGlobalPrompt({
      persona: employee.agentInformation || `You are ${employee.name}, ${employee.role}.`,
      stylePackEnabled: employee.stylePackEnabled,
      aiAcknowledgementEnabled: employee.aiAcknowledgementEnabled,
      antiEarlyHangupEnabled: true,
      scriptAdherence: employee.scriptAdherence,
      callEndRules: employee.callEndRules ?? undefined,
    });

    const webhookSecret = this.config.get<string>('WEBHOOK_API_KEY_DOGRAH', '');
    // Dograh is a separate container that must reach this backend over the docker bridge —
    // PUBLIC_URL is browser-facing (localhost on the host) and unreachable from inside the
    // dograh container, so the webhook callback gets its own container-reachable base.
    const publicUrl = this.config.get<string>('DOGRAH_WEBHOOK_URL', 'http://host.docker.internal:3001');

    const definition = this.dograh.compileEmployeeDefinition({
      employeeId: employee.id,
      composedPersona,
      // The greeting is the ONE piece of speech that is spoken verbatim rather than generated by
      // the LLM, so it must already be in the employee's language — the style pack governs every
      // later turn but cannot touch this string. An English default on a te-IN employee is why a
      // Telugu agent opened the call in English.
      // No {{first_name}} either: most calls (instant leads, test calls) have no name in
      // initial_context, and an unresolved template var reads as dead air ("Hello, is this ?").
      greeting: employee.welcomeMessage || defaultGreeting(employee.language),
      sections: employee.sections.map((s) => ({
        sectionKey: s.sectionKey, label: s.label, prompt: s.prompt, enabled: s.enabled,
        order: s.order, nodeType: s.nodeType, edges: (s.edges as any) || [],
      })),
      variables: employee.variables.map((v) => ({ key: v.key, label: v.label, source: v.source, required: v.required, extractHint: v.extractHint })),
      outboundWebhookUrl: `${publicUrl}/voice-calls/webhook/employee-call-completed`,
      webhookSecretHeader: webhookSecret || undefined,
    });

    let workflowId = employee.dograhWorkflowId;
    let workflowUuid = employee.dograhWorkflowUuid;
    if (!workflowId) {
      const created = await this.dograh.createWorkflow(`employee-${employee.id}`, definition);
      workflowId = created.id;
      workflowUuid = created.uuid;
    } else {
      await this.dograh.publishWorkflowDefinition(workflowId, `employee-${employee.id}`, definition);
    }

    // Always bump the revision — publish is an explicit user action, and gating the bump on
    // hasUnpublishedChanges collided with the last version's row when nothing had changed since
    // (unique constraint on employee_id+revision).
    const nextRevision = employee.revision + 1;

    const [updated] = await this.prisma.$transaction([
      this.prisma.voiceEmployee.update({
        where: { id },
        data: {
          dograhWorkflowId: workflowId,
          dograhWorkflowUuid: workflowUuid,
          isPublished: true,
          hasUnpublishedChanges: false,
          publishedAt: new Date(),
          revision: nextRevision,
          status: employee.status === 'inactive' ? 'inactive' : employee.status,
        },
        include: { sections: { orderBy: { order: 'asc' } }, variables: true },
      }),
      this.prisma.voiceEmployeeVersion.create({
        data: {
          employeeId: id,
          revision: nextRevision,
          publishedById,
          snapshot: JSON.parse(JSON.stringify({
            name: employee.name, role: employee.role, welcomeMessage: employee.welcomeMessage,
            agentInformation: employee.agentInformation, callEndRules: employee.callEndRules,
            sections: employee.sections, variables: employee.variables,
          })),
        },
      }),
    ]);

    this.logger.log(`Employee ${id} published — Dograh workflow ${workflowId}, revision ${nextRevision}`);
    return updated;
  }

  async listVersions(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.voiceEmployeeVersion.findMany({ where: { employeeId: id }, orderBy: { revision: 'desc' } });
  }

  /** Restores a prior published snapshot as the current draft — mirrors Outpero's
   * /employees/{id}/versions/{n}/restore. Does NOT auto-publish; the owner reviews the restored
   * draft and publishes explicitly, same as any other edit. */
  async restoreVersion(tenantId: string, id: string, revision: number) {
    await this.get(tenantId, id);
    const version = await this.prisma.voiceEmployeeVersion.findUnique({ where: { employeeId_revision: { employeeId: id, revision } } });
    if (!version) throw new NotFoundException(`Revision ${revision} not found`);

    const snapshot = version.snapshot as any;
    return this.update(tenantId, id, {
      name: snapshot.name, role: snapshot.role, welcomeMessage: snapshot.welcomeMessage,
      agentInformation: snapshot.agentInformation, callEndRules: snapshot.callEndRules,
      sections: (snapshot.sections || []).map((s: any) => ({ sectionKey: s.sectionKey, label: s.label, prompt: s.prompt, enabled: s.enabled, order: s.order, nodeType: s.nodeType, edges: s.edges })),
      variables: (snapshot.variables || []).map((v: any) => ({ key: v.key, label: v.label, source: v.source, required: v.required, extractHint: v.extractHint })),
    });
  }

  async activate(tenantId: string, id: string) {
    const employee = await this.get(tenantId, id);
    if (!employee.isPublished) throw new BadRequestException('Publish the employee before activating it');
    return this.prisma.voiceEmployee.update({ where: { id }, data: { status: 'active' } });
  }

  async deactivate(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.prisma.voiceEmployee.update({ where: { id }, data: { status: 'inactive' } });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.voiceEmployee.update({ where: { id }, data: { deletedAt: new Date(), status: 'inactive' } });
    return { deleted: true };
  }

  /** Places a real test call using this employee's published Dograh workflow. Fails clearly if
   * the employee has never been published — there is no workflow to call yet. */
  async testCall(tenantId: string, id: string, toNumber: string, context: Record<string, any> = {}) {
    const employee = await this.get(tenantId, id);
    if (!employee.dograhWorkflowUuid) throw new BadRequestException('Publish the employee before test-calling it');
    const call = await this.dograh.triggerCall(employee.dograhWorkflowUuid, toNumber, context);
    return { success: true, callSid: String(call.workflow_run_id) };
  }

  async checkReadiness(tenantId: string, id: string) {
    const employee = await this.get(tenantId, id);
    return this.generator.checkReadiness(
      employee.sections.map((s) => ({
        sectionKey: s.sectionKey, label: s.label, prompt: s.prompt, enabled: s.enabled,
        order: s.order, nodeType: s.nodeType, edges: s.edges as any,
      })),
    );
  }
}
