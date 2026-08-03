import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResolveLeadService } from '../src/leads/resolve-lead.service';
import { EscalationService } from '../src/mikey/escalation.service';
import { CoachService } from '../src/coach/coach.service';
import { AutonomyGuardrailsService } from '../src/mikey/autonomy-guardrails.service';
import { FollowUpSchedulerService } from '../src/automation/follow-up-scheduler.service';

/**
 * Phases 3-9 against a real database.
 *
 * The unit tests all mock Prisma, so they prove the logic but not that the
 * schema, the migrations and the wiring agree with each other — which is
 * exactly where this project has been bitten before (a missing @map passed
 * `migrate status` and failed at query time).
 */
describe('Rails: resolve, escalation, coach, autonomy, follow-up clock', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let resolveLead: ResolveLeadService;
  let escalation: EscalationService;
  let coach: CoachService;
  let guardrails: AutonomyGuardrailsService;
  let followUps: FollowUpSchedulerService;

  let tenantId: string;
  let agentId: string;
  const createdLeadIds: string[] = [];
  const createdContactIds: string[] = [];
  const phone = `+9198${Date.now().toString().slice(-8)}`;

  beforeAll(async () => {
    tenantId = process.env.DEFAULT_TENANT_ID || 'default-tenant';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    resolveLead = app.get(ResolveLeadService);
    escalation = app.get(EscalationService);
    coach = app.get(CoachService);
    guardrails = app.get(AutonomyGuardrailsService);
    followUps = app.get(FollowUpSchedulerService);

    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) {
      await prisma.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId, settings: {} } });
    }
    const user = await prisma.user.create({
      data: {
        tenantId, email: `rails-${Date.now()}@test.com`,
        password: await bcrypt.hash('testpass', 1), name: 'Rails Rep', role: 'SALES_AGENT',
      },
    });
    agentId = user.id;
  }, 120000);

  afterAll(async () => {
    for (const leadId of createdLeadIds) {
      await prisma.callCoaching.deleteMany({ where: { leadId } }).catch(() => {});
      await prisma.leadEscalation.deleteMany({ where: { leadId } }).catch(() => {});
      await prisma.scheduledAction.deleteMany({ where: { leadId } }).catch(() => {});
      await prisma.callLog.deleteMany({ where: { leadId } }).catch(() => {});
      await prisma.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
    for (const contactId of createdContactIds) {
      await prisma.contact.delete({ where: { id: contactId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { id: agentId } }).catch(() => {});
    await app.close();
  }, 60000);

  describe('Phase 4: resolve', () => {
    it('the same buyer on four portals is one lead with four touches, one rep', async () => {
      const sources = ['FORM', 'MAGICBRICKS', '99ACRES', 'HOUSING'];
      const results: Awaited<ReturnType<typeof resolveLead.resolveLead>>[] = [];
      for (const source of sources) {
        results.push(await resolveLead.resolveLead({
          tenantId, phone, name: 'Ravi Kumar', source, interest: '2BHK Kompally',
        }));
      }
      createdLeadIds.push(...new Set(results.map(r => r.leadId)));
      createdContactIds.push(...new Set(results.map(r => r.contactId)));

      const uniqueLeads = new Set(results.map(r => r.leadId));
      expect(uniqueLeads.size).toBe(1);
      expect(results[0].reusedExistingLead).toBe(false);
      expect(results[3].reusedExistingLead).toBe(true);

      const lead = await prisma.lead.findUnique({ where: { id: results[0].leadId } });
      expect((lead!.metadata as any).touches).toHaveLength(4);
      // Repeat enquiries are a hot signal, not four new leads.
      expect(lead!.score).toBeGreaterThanOrEqual(45);
    }, 60000);
  });

  describe('Phase 5: escalation', () => {
    let leadId: string;

    beforeAll(async () => {
      const r = await resolveLead.resolveLead({
        tenantId, phone: `+9197${Date.now().toString().slice(-8)}`, name: 'Esc Buyer', source: 'FORM',
      });
      leadId = r.leadId;
      createdLeadIds.push(leadId);
      createdContactIds.push(r.contactId);
      await prisma.lead.update({ where: { id: leadId }, data: { assignedAgentId: agentId } });
    }, 60000);

    it('detects a request for a human and writes a real escalation row', async () => {
      const trigger = escalation.detectTrigger({ text: 'can I talk to a human please' });
      expect(trigger!.trigger).toBe('LEAD_REQUESTED_HUMAN');

      const res = await escalation.raise({
        tenantId, leadId, trigger: trigger!.trigger, detail: trigger!.detail,
      });

      expect(res.alreadyPaused).toBe(false);
      const row = await prisma.leadEscalation.findFirst({ where: { leadId, resolvedAt: null } });
      expect(row).toBeTruthy();
      expect(row!.trigger).toBe('LEAD_REQUESTED_HUMAN');
    }, 60000);

    it('an escalated lead is left alone even with the dial on autonomous', async () => {
      await guardrails.setCategoryLevel(tenantId, 'lead_messaging', 'autonomous');

      const gate = await guardrails.canMessageLeadAutonomously(tenantId, 'lead_messaging', leadId);
      expect(gate.allowed).toBe(false);
      expect(gate.reason).toContain('escalated');

      const send = await guardrails.canAutoSend(tenantId, leadId);
      expect(send.allowed).toBe(false);
    }, 60000);

    it('cancels queued chasing so Mikey does not nudge over the human', async () => {
      // Queue work, then escalate a second lead and prove the clock stopped.
      const r = await resolveLead.resolveLead({
        tenantId, phone: `+9196${Date.now().toString().slice(-8)}`, name: 'Chase Buyer', source: 'FORM',
      });
      createdLeadIds.push(r.leadId);
      createdContactIds.push(r.contactId);

      await followUps.schedule({
        leadId: r.leadId, kind: 'followup', runAt: new Date(Date.now() + 3600_000),
        dedupeKey: `rails-test:${r.leadId}`, payload: { text: 'still interested?' },
      });
      expect(await followUps.pendingForLead(r.leadId)).toHaveLength(1);

      await escalation.raise({
        tenantId, leadId: r.leadId, trigger: 'PRICE_NEGOTIATION', detail: 'asked for best price',
      });

      expect(await followUps.pendingForLead(r.leadId)).toHaveLength(0);
    }, 60000);

    it('does not raise a second escalation while one is open', async () => {
      const again = await escalation.raise({
        tenantId, leadId, trigger: 'NEGATIVE_SENTIMENT', detail: 'still cross',
      });
      expect(again.alreadyPaused).toBe(true);

      const rows = await prisma.leadEscalation.count({ where: { leadId, resolvedAt: null } });
      expect(rows).toBe(1);
    }, 60000);

    it('resolving the escalation lets Mikey act again', async () => {
      const row = await prisma.leadEscalation.findFirst({ where: { leadId, resolvedAt: null } });
      await escalation.resolve(tenantId, row!.id, agentId);

      expect(await escalation.isPaused(tenantId, leadId)).toBe(false);
      const gate = await guardrails.canMessageLeadAutonomously(tenantId, 'lead_messaging', leadId);
      expect(gate.reason ?? '').not.toContain('escalated');
    }, 60000);
  });

  describe('Phase 7: coach', () => {
    it('produces coaching from a real call log', async () => {
      const r = await resolveLead.resolveLead({
        tenantId, phone: `+9195${Date.now().toString().slice(-8)}`, name: 'Coach Buyer', source: 'FORM',
      });
      createdLeadIds.push(r.leadId);
      createdContactIds.push(r.contactId);

      const call = await prisma.callLog.create({
        data: {
          tenantId, leadId: r.leadId, agentId, direction: 'OUTBOUND', status: 'COMPLETED',
          fromNumber: '+919000000000', toNumber: phone, durationSec: 240,
          transcript:
            'What is your budget? Around 70 lakh. Which area do you prefer? Kompally. ' +
            'When are you looking to buy? Within 3 months. Loan or cash? Home loan. ' +
            'Can I book a site visit this Sunday? Yes please.',
          summary: 'Wants 2BHK in Kompally',
        },
      });

      const res = await coach.coachCall(call.id);
      expect(res).toBeTruthy();

      const row = await prisma.callCoaching.findUnique({ where: { callLogId: call.id } });
      expect(row!.score).toBeGreaterThanOrEqual(85);
      expect(row!.missedQuestions).toEqual([]);
      expect(row!.buyingSignals).toContain('asked to visit');
      expect(row!.isExemplar).toBe(true);

      // One coaching row per call, however many times the summariser retries.
      await coach.coachCall(call.id);
      expect(await prisma.callCoaching.count({ where: { callLogId: call.id } })).toBe(1);
    }, 90000);

    it('scores a call with no transcript as unknown, not as zero', async () => {
      const r = await resolveLead.resolveLead({
        tenantId, phone: `+9194${Date.now().toString().slice(-8)}`, name: 'Silent Buyer', source: 'FORM',
      });
      createdLeadIds.push(r.leadId);
      createdContactIds.push(r.contactId);

      const call = await prisma.callLog.create({
        data: {
          tenantId, leadId: r.leadId, agentId, direction: 'OUTBOUND', status: 'COMPLETED',
          fromNumber: '+919000000000', toNumber: phone,
        },
      });
      await coach.coachCall(call.id);

      const row = await prisma.callCoaching.findUnique({ where: { callLogId: call.id } });
      expect(row!.score).toBeNull();
      expect(row!.analysisStatus).toBe('NO_TRANSCRIPT');
    }, 90000);
  });

  describe('Phase 6: autonomy dials', () => {
    it('turning off money leaves scheduling free to act', async () => {
      await guardrails.setCategoryLevel(tenantId, 'money', 'off');
      await guardrails.setCategoryLevel(tenantId, 'scheduling', 'autonomous');

      expect((await guardrails.canActInternally(tenantId, 'money')).allowed).toBe(false);
      expect((await guardrails.canActInternally(tenantId, 'scheduling')).allowed).toBe(true);
    }, 60000);
  });
});
