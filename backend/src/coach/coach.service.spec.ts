import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CoachService } from './coach.service';
import { CoachAnalysisService } from './coach-analysis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CoachService (Phase 7, Rail D)', () => {
  let service: CoachService;
  let analysis: CoachAnalysisService;
  let prisma: any;

  const goodCall = {
    id: 'call-1',
    tenantId: 't1',
    agentId: 'agent-1',
    leadId: 'lead-1',
    durationSec: 240,
    summary: 'Discussed 2BHK in Kompally',
    transcript:
      'What is your budget? Around 70 lakh. Which area do you prefer? Kompally. ' +
      'When are you looking to buy? Within 3 months. Will you take a loan or pay cash? Home loan. ' +
      'Can I book a site visit this Sunday? Yes please.',
  };

  beforeEach(async () => {
    prisma = {
      callLog: { findUnique: jest.fn().mockResolvedValue(goodCall) },
      callCoaching: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'coach-1' })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachService,
        CoachAnalysisService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(CoachService);
    analysis = module.get(CoachAnalysisService);
  });

  describe('coachCall', () => {
    it('produces a coaching row for a call', async () => {
      const res = await service.coachCall('call-1');

      expect(res?.coachingId).toBe('coach-1');
      const created = prisma.callCoaching.create.mock.calls[0][0].data;
      expect(created.userId).toBe('agent-1');
      // DONE_RULES here because the test env has no DEEPSEEK_API_KEY. The
      // status records which engine scored the call, so a run of DONE_RULES
      // in production means the LLM is failing rather than the coach quietly
      // getting worse.
      expect(created.analysisStatus).toBe('DONE_RULES');
      expect(created.score).toBeGreaterThan(0);
    });

    it('is idempotent: one coaching row per call', async () => {
      prisma.callCoaching.findUnique.mockResolvedValue({ id: 'existing' });

      const res = await service.coachCall('call-1');

      expect(res?.coachingId).toBe('existing');
      expect(prisma.callCoaching.create).not.toHaveBeenCalled();
    });

    it('records a call with no transcript as unknown, not as a zero', async () => {
      // Punishing a rep for a recording that failed to upload is how the tool
      // loses their trust on day one.
      prisma.callLog.findUnique.mockResolvedValue({ ...goodCall, transcript: null, summary: null });

      await service.coachCall('call-1');

      const created = prisma.callCoaching.create.mock.calls[0][0].data;
      expect(created.score).toBeNull();
      expect(created.analysisStatus).toBe('NO_TRANSCRIPT');
      expect(created.isExemplar).toBe(false);
    });

    it('returns null for a call that does not exist', async () => {
      prisma.callLog.findUnique.mockResolvedValue(null);
      expect(await service.coachCall('nope')).toBeNull();
    });

    it('coaches a call Mikey handled with no rep attached', async () => {
      prisma.callLog.findUnique.mockResolvedValue({ ...goodCall, agentId: null });
      await service.coachCall('call-1');
      expect(prisma.callCoaching.create.mock.calls[0][0].data.userId).toBeNull();
    });
  });

  describe('analysis: keyword fallback', () => {
    // No DEEPSEEK_API_KEY in the test env, so these exercise the rules path
    // that keeps the coach answering when the model is unavailable.
    it('scores a call that covered all four questions highly', async () => {
      const r = await analysis.analyze(goodCall);
      expect(r.method).toBe('rules');
      expect(r.missedQuestions).toEqual([]);
      expect(r.score).toBeGreaterThanOrEqual(85);
      expect(r.buyingSignals).toContain('asked to visit');
    });

    it('names the questions a rep skipped', async () => {
      const r = await analysis.analyze({
        transcript: 'Hi, the project is lovely, lots of amenities, we have a clubhouse.',
        durationSec: 120,
      });
      expect(r.missedQuestions).toEqual(
        expect.arrayContaining(['budget', 'preferred location', 'timeline', 'loan or cash']),
      );
      expect(r.recommendedAction).toMatch(/basics you missed/);
    });

    it('spots a price objection and does not suggest discounting', async () => {
      const r = await analysis.analyze({
        transcript: 'What is your budget? This is too expensive for me, anything cheaper?',
        durationSec: 90,
      });
      expect(r.objections).toContain('price too high');
      // Steers to affordability, not to cutting the price.
      expect(r.recommendedAction).toMatch(/payment plan/);
      expect(r.recommendedAction).not.toMatch(/(offer|give|approve)\s+(a\s+)?discount/i);
      expect(r.whatToSend).toMatch(/EMI/);
    });

    it('drops the deal probability when objections pile up', async () => {
      const withObjections = await analysis.analyze({
        transcript: 'Too expensive and too far, and possession is delayed, comparing with another builder.',
        durationSec: 100,
      });
      const clean = await analysis.analyze(goodCall);
      expect(withObjections.dealProbability!).toBeLessThan(clean.dealProbability!);
    });

    it('never returns a probability outside 0 to 1', async () => {
      const r = await analysis.analyze({
        transcript: 'too expensive too far delayed comparing another builder ask my wife loan not sanctioned',
        durationSec: 30,
      });
      expect(r.dealProbability).toBeGreaterThanOrEqual(0);
      expect(r.dealProbability).toBeLessThanOrEqual(1);
    });
  });

  describe('analysis: LLM path', () => {
    const stubLlm = (content: string) => {
      (analysis as any).llm = {
        chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }) } },
      };
    };

    it('uses the model when one is configured', async () => {
      stubLlm(JSON.stringify({
        score: 72,
        missedQuestions: ['loan or cash'],
        objections: ['comparing competitors'],
        buyingSignals: ['asked to visit'],
        recommendedAction: 'Lock Sunday for the visit before he sees the other project.',
        whatToSend: 'Location pin and floor plan',
        dealProbability: 0.55,
      }));

      const r = await analysis.analyze(goodCall);

      expect(r.method).toBe('llm');
      expect(r.score).toBe(72);
      expect(r.recommendedAction).toMatch(/Lock Sunday/);
    });

    it('survives the model wrapping its JSON in a markdown fence', async () => {
      stubLlm('```json\n{"score":80,"missedQuestions":[],"objections":[],"buyingSignals":[],"recommendedAction":"Book the visit.","whatToSend":null,"dealProbability":0.6}\n```');

      const r = await analysis.analyze(goodCall);

      expect(r.method).toBe('llm');
      expect(r.score).toBe(80);
    });

    it('clamps a score the model gets wrong instead of showing it to a rep', async () => {
      stubLlm(JSON.stringify({
        score: 150, missedQuestions: [], objections: [], buyingSignals: [],
        recommendedAction: 'x', whatToSend: null, dealProbability: 4.2,
      }));

      const r = await analysis.analyze(goodCall);

      expect(r.score).toBe(100);
      expect(r.dealProbability).toBe(1);
    });

    it('falls back to rules when the model returns nonsense', async () => {
      stubLlm('I am afraid I cannot help with that.');

      const r = await analysis.analyze(goodCall);

      // The coach must never go silent. A rep only learns from feedback that
      // arrives every time.
      expect(r.method).toBe('rules');
      expect(r.score).toBeGreaterThan(0);
    });

    it('falls back to rules when the provider throws', async () => {
      (analysis as any).llm = {
        chat: { completions: { create: jest.fn().mockRejectedValue(new Error('429 rate limited')) } },
      };

      const r = await analysis.analyze(goodCall);

      expect(r.method).toBe('rules');
      expect(r.recommendedAction).toBeTruthy();
    });
  });

  describe('adminOverview', () => {
    it('averages over scored calls only, so failed recordings do not punish a rep', async () => {
      prisma.callCoaching.findMany.mockResolvedValue([
        { userId: 'u1', score: 90, missedQuestions: [], objections: [], user: { id: 'u1', name: 'Asha' } },
        { userId: 'u1', score: null, missedQuestions: [], objections: [], user: { id: 'u1', name: 'Asha' } },
        { userId: 'u2', score: 50, missedQuestions: ['budget'], objections: ['price too high'], user: { id: 'u2', name: 'Ravi' } },
      ]);

      const res = await service.adminOverview('t1');

      const asha = res.reps.find((r) => r.userId === 'u1')!;
      expect(asha.calls).toBe(2);
      expect(asha.avgScore).toBe(90); // not 45
      expect(res.reps[0].userId).toBe('u1'); // ranked best first
      expect(res.reps.find((r) => r.userId === 'u2')!.topGap).toBe('budget');
    });
  });
});
