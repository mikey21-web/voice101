import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CoachAnalysisService } from './coach-analysis.service';

/** Score at or above this and the call is worth showing a new rep. */
const EXEMPLAR_SCORE = 85;

/**
 * Phase 7, Rail D. Fires after every call at every stage, not only the
 * negotiation call, because the first call and the loan-chase call are where
 * most deals are actually lost.
 *
 * Reads the transcript that `call-tracking/call-summary.service.ts` already
 * produces, so this is analysis rather than plumbing.
 */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private prisma: PrismaService,
    private analysis: CoachAnalysisService,
  ) {}

  /** Called when a call is summarised. Idempotent: one coaching row per call. */
  async coachCall(callLogId: string): Promise<{ coachingId: string } | null> {
    const callLog = await this.prisma.callLog.findUnique({ where: { id: callLogId } });
    if (!callLog) {
      this.logger.warn(`coachCall: no call log ${callLogId}`);
      return null;
    }

    const existing = await this.prisma.callCoaching.findUnique({ where: { callLogId } });
    if (existing) return { coachingId: existing.id };

    const result = this.analysis.analyze({
      transcript: callLog.transcript,
      summary: callLog.summary,
      durationSec: callLog.durationSec,
    });

    const coaching = await this.prisma.callCoaching.create({
      data: {
        tenantId: callLog.tenantId,
        callLogId,
        userId: callLog.agentId,
        leadId: callLog.leadId,
        score: result.score,
        missedQuestions: result.missedQuestions,
        objections: result.objections,
        buyingSignals: result.buyingSignals,
        recommendedAction: result.recommendedAction,
        whatToSend: result.whatToSend,
        dealProbability: result.dealProbability,
        isExemplar: (result.score ?? 0) >= EXEMPLAR_SCORE,
        analysisStatus: result.score === null ? 'NO_TRANSCRIPT' : 'DONE',
      },
    });

    return { coachingId: coaching.id };
  }

  /** What one rep sees: their own calls only. */
  async forRep(tenantId: string, userId: string, limit = 20) {
    return this.prisma.callCoaching.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { callLog: { select: { id: true, createdAt: true, durationSec: true, summary: true } } },
    });
  }

  /**
   * What an admin sees: every rep side by side. Only ever reached through the
   * admin-only route, never surfaced to reps.
   */
  async adminOverview(tenantId: string, sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.callCoaching.findMany({
      where: { tenantId, createdAt: { gte: since }, userId: { not: null } },
      include: { user: { select: { id: true, name: true } } },
    });

    const byRep = new Map<string, { userId: string; name: string; calls: number; totalScore: number; scored: number; missed: Map<string, number>; objections: Map<string, number> }>();
    for (const row of rows) {
      const id = row.userId!;
      if (!byRep.has(id)) {
        byRep.set(id, { userId: id, name: row.user?.name || 'Unknown', calls: 0, totalScore: 0, scored: 0, missed: new Map(), objections: new Map() });
      }
      const rep = byRep.get(id)!;
      rep.calls++;
      if (row.score !== null) { rep.totalScore += row.score; rep.scored++; }
      for (const m of row.missedQuestions) rep.missed.set(m, (rep.missed.get(m) || 0) + 1);
      for (const o of row.objections) rep.objections.set(o, (rep.objections.get(o) || 0) + 1);
    }

    const reps = [...byRep.values()]
      .map((r) => ({
        userId: r.userId,
        name: r.name,
        calls: r.calls,
        // Averaged over scored calls only, so a batch of failed recordings
        // does not drag a rep's average down.
        avgScore: r.scored ? Math.round(r.totalScore / r.scored) : null,
        topGap: this.topOf(r.missed),
        topObjection: this.topOf(r.objections),
      }))
      .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

    return {
      reps,
      teamAvgScore: reps.length
        ? Math.round(reps.reduce((s, r) => s + (r.avgScore ?? 0), 0) / reps.filter((r) => r.avgScore !== null).length || 0)
        : null,
      totalCalls: rows.length,
    };
  }

  /** Calls good enough to learn from. This is how a new rep ramps. */
  async knowledgeBase(tenantId: string, limit = 20) {
    return this.prisma.callCoaching.findMany({
      where: { tenantId, isExemplar: true },
      orderBy: { score: 'desc' },
      take: limit,
      include: { callLog: { select: { id: true, summary: true, transcript: true, durationSec: true } } },
    });
  }

  private topOf(counts: Map<string, number>): string | null {
    let best: string | null = null;
    let bestN = 0;
    for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
    return best;
  }
}
