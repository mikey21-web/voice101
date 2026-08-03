import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_QUIET_HOURS_START = 21;
const DEFAULT_QUIET_HOURS_END = 8;
const DEFAULT_DAILY_CAP = 50;
const DEFAULT_LEAD_COOLDOWN_HOURS = 24;
const DEFAULT_AUTO_SEND_MODE = 'enabled';
/** advanceStage writes one of these per transition for audit/undo. See isUnderDailyCap. */
const STAGE_BOOKKEEPING_TOOL = 'advance_stage';

/**
 * Every autonomous action belongs to exactly one category so an owner can dial
 * autonomy per category instead of one global on/off switch.
 *
 * `jarvis_tools` used to be a single dial covering everything from "book a site
 * visit" to "issue a demand letter". It is split into money/inventory/
 * scheduling/documents so money never shares a switch with scheduling. The old
 * value is still read from stored settings for back-compat (see LEGACY_TOOL_CATEGORY).
 */
export type AutonomyCategory =
  | 'lead_assignment' | 'lead_messaging' | 'task_escalation'
  | 'money' | 'inventory' | 'scheduling' | 'documents';
export const AUTONOMY_CATEGORIES: AutonomyCategory[] = [
  'lead_assignment', 'lead_messaging', 'task_escalation',
  'money', 'inventory', 'scheduling', 'documents',
];

/** The pre-split dial. Existing tenants have this stored; it seeds the four new ones. */
const LEGACY_TOOL_CATEGORY = 'jarvis_tools';
const SPLIT_FROM_LEGACY: AutonomyCategory[] = ['inventory', 'scheduling', 'documents'];

/** off: never acts, only reports. shadow: runs the same decision as autonomous but only logs what it would have done — no write, no approval-queue entry, so an owner can validate a category before trusting it live. observe: drafts every action to the approval queue for one-tap approve/reject. autonomous: acts on its own, subject to the other guardrails below. */
export type AutonomyLevel = 'off' | 'shadow' | 'observe' | 'autonomous';

/**
 * Deterministic, pre-LLM checks that gate every autonomous (unprompted)
 * action Mikey takes. These run before any autonomous write — a per-category
 * on/off dial the owner controls, quiet hours, a per-lead cooldown so the
 * same lead never gets nudged twice in a day, and a daily cap so a bug can't
 * fire hundreds of actions unattended. Cheap and reliable on purpose: the LLM
 * decides *what* to do, this decides whether it's allowed to do it at all
 * right now.
 */
@Injectable()
export class AutonomyGuardrailsService {
  constructor(private prisma: PrismaService) {}

  private async getTenantSettings(tenantId: string): Promise<Record<string, any>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    return (tenant?.settings as Record<string, any>) || {};
  }

  /**
   * New tenants default to 'observe' for every category so Mikey is
   * observe-first by default.
   *
   * `money` never inherits the old jarvis_tools dial. A tenant who once set
   * that to autonomous did so for site visits and unit holds, not for demand
   * letters and token requests, so money stays observe until set explicitly.
   */
  async getCategoryLevel(tenantId: string, category: AutonomyCategory): Promise<AutonomyLevel> {
    const settings = await this.getTenantSettings(tenantId);
    const stored = settings.mikeyAutonomyCategories || {};
    if (stored[category]) return stored[category];
    if (SPLIT_FROM_LEGACY.includes(category) && stored[LEGACY_TOOL_CATEGORY]) {
      return stored[LEGACY_TOOL_CATEGORY];
    }
    return 'observe';
  }

  async setCategoryLevel(tenantId: string, category: AutonomyCategory, level: AutonomyLevel): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings as Record<string, any>) || {};
    const categories = { ...(settings.mikeyAutonomyCategories || {}), [category]: level };
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, mikeyAutonomyCategories: categories } } });
  }

  async getAllCategoryLevels(tenantId: string): Promise<Record<AutonomyCategory, AutonomyLevel>> {
    const levels = await Promise.all(
      AUTONOMY_CATEGORIES.map(async (c) => [c, await this.getCategoryLevel(tenantId, c)] as const),
    );
    return Object.fromEntries(levels) as Record<AutonomyCategory, AutonomyLevel>;
  }

  async isQuietHours(tenantId: string): Promise<boolean> {
    const settings = await this.getTenantSettings(tenantId);
    const start = settings.autonomyQuietHoursStart ?? DEFAULT_QUIET_HOURS_START;
    const end = settings.autonomyQuietHoursEnd ?? DEFAULT_QUIET_HOURS_END;
    const hour = new Date().getHours();
    if (start === end) return false; // quiet hours disabled
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end; // wraps past midnight
  }

  async isUnderDailyCap(tenantId: string): Promise<boolean> {
    const settings = await this.getTenantSettings(tenantId);
    const cap = settings.autonomyDailyCap ?? DEFAULT_DAILY_CAP;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const count = await this.prisma.mikeyAutonomousAction.count({
      where: {
        tenantId,
        createdAt: { gte: todayStart },
        // Stage advances are bookkeeping, not outbound actions. They are
        // recorded here for audit and undo, but counting them means a busy
        // day of leads simply moving through the pipeline exhausts the budget
        // and silently switches Mikey off. The cap exists to stop a bug firing
        // hundreds of messages, not to limit how many leads change status.
        tool: { not: STAGE_BOOKKEEPING_TOOL },
      },
    });
    return count < cap;
  }

  async isLeadOffCooldown(tenantId: string, leadId: string): Promise<boolean> {
    const settings = await this.getTenantSettings(tenantId);
    const cooldownHours = settings.autonomyLeadCooldownHours ?? DEFAULT_LEAD_COOLDOWN_HOURS;
    const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
    const recent = await this.prisma.mikeyAutonomousAction.findFirst({
      where: { tenantId, leadId, createdAt: { gte: since } },
    });
    return !recent;
  }

  /** All internal (non-messaging) checks: category dial, then daily cap — quiet hours and per-lead cooldown are message-specific. */
  async canActInternally(tenantId: string, category: AutonomyCategory): Promise<{ allowed: boolean; reason?: string; mode?: AutonomyLevel }> {
    const level = await this.getCategoryLevel(tenantId, category);
    if (level === 'off') return { allowed: false, reason: `${category} autonomy is turned off` };
    if (level === 'observe') return { allowed: true, mode: 'observe', reason: `${category} is in observe-only mode — drafting for approval` };
    if (level === 'shadow') return { allowed: true, mode: 'shadow', reason: `${category} is in shadow mode — logging what would happen, not acting` };
    if (!(await this.isUnderDailyCap(tenantId))) return { allowed: false, reason: 'daily autonomous action cap reached' };
    return { allowed: true, mode: 'autonomous' };
  }

  /** Lead-facing auto-send (the persist-node automatic reply when the agent doesn't call send_message tool). Default is enabled for 24/7 lead answering; per-tenant override exists for owners who want it gated by quiet hours + daily cap. */
  async getAutoSendMode(tenantId: string): Promise<'enabled' | 'guarded' | 'disabled'> {
    const settings = await this.getTenantSettings(tenantId);
    return settings.leadAutoSendMode ?? DEFAULT_AUTO_SEND_MODE;
  }

  async canAutoSend(tenantId: string, leadId: string): Promise<{ allowed: boolean; reason?: string }> {
    const mode = await this.getAutoSendMode(tenantId);
    if (mode === 'disabled') return { allowed: false, reason: 'auto-send is disabled for this tenant' };
    // Escalation beats auto-send mode. 'enabled' skips quiet hours and caps for
    // 24/7 answering, but it must not talk over the human who took this lead.
    if (await this.isEscalated(tenantId, leadId)) {
      return { allowed: false, reason: 'lead is escalated to a human' };
    }
    if (mode === 'enabled') return { allowed: true };
    if (await this.isQuietHours(tenantId)) return { allowed: false, reason: 'quiet hours' };
    if (!(await this.isUnderDailyCap(tenantId))) return { allowed: false, reason: 'daily auto-send cap reached' };
    if (!(await this.isLeadOffCooldown(tenantId, leadId))) return { allowed: false, reason: 'lead was already messaged within cooldown window' };
    return { allowed: true };
  }

  /** An open escalation is a per-lead pause: a human is on this one, Mikey is not. */
  private async isEscalated(tenantId: string, leadId: string): Promise<boolean> {
    const open = await this.prisma.leadEscalation.findFirst({
      where: { tenantId, leadId, resolvedAt: null },
      select: { id: true },
    });
    return !!open;
  }

  /** Full check for any autonomous action that messages a specific lead. */
  async canMessageLeadAutonomously(tenantId: string, category: AutonomyCategory, leadId: string): Promise<{ allowed: boolean; reason?: string; mode?: AutonomyLevel }> {
    const level = await this.getCategoryLevel(tenantId, category);
    if (level === 'off') return { allowed: false, reason: `${category} autonomy is turned off` };
    // Checked before shadow mode too: once a human takes over, even a "what
    // would I have done" log entry is noise on a lead Mikey should leave alone.
    if (await this.isEscalated(tenantId, leadId)) {
      return { allowed: false, reason: 'lead is escalated to a human' };
    }
    if (level === 'observe') return { allowed: false, mode: 'observe', reason: `${category} is in observe-only mode — drafting for approval` };
    if (level === 'shadow') return { allowed: true, mode: 'shadow', reason: `${category} is in shadow mode — logging what would happen, not acting` };
    if (await this.isQuietHours(tenantId)) return { allowed: false, reason: 'quiet hours' };
    if (!(await this.isUnderDailyCap(tenantId))) return { allowed: false, reason: 'daily autonomous action cap reached' };
    if (!(await this.isLeadOffCooldown(tenantId, leadId))) return { allowed: false, reason: 'lead was already actioned autonomously within the cooldown window' };
    return { allowed: true, mode: 'autonomous' };
  }
}
