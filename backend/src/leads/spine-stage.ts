import { LeadStatus } from '@prisma/client';

export type SpineStage =
  | 'CAPTURE' | 'RESOLVE' | 'ENGAGE' | 'QUALIFY' | 'MATCH'
  | 'APPOINTMENT' | 'HUMAN_SALES' | 'BOOKING'
  | 'CLOSED_LOST';

export const STATUS_TO_STAGE: Record<LeadStatus, SpineStage> = {
  NEW: 'CAPTURE',
  CONTACTED: 'ENGAGE',
  ENGAGED: 'QUALIFY',
  QUALIFYING: 'QUALIFY',
  QUALIFIED: 'QUALIFY',
  PROPOSAL_SENT: 'MATCH',
  APPOINTMENT_BOOKED: 'APPOINTMENT',
  CONVERTED: 'BOOKING',
  LOST: 'CLOSED_LOST',
  COLD: 'CLOSED_LOST',
  SPAM: 'CLOSED_LOST',
};

export const STAGE_ORDER: SpineStage[] = [
  'CAPTURE', 'RESOLVE', 'ENGAGE', 'QUALIFY', 'MATCH', 'APPOINTMENT',
  'HUMAN_SALES', 'BOOKING', 'CLOSED_LOST',
];

export function stageOf(status: LeadStatus): SpineStage {
  return STATUS_TO_STAGE[status];
}

// Stage may only move forward (or stay). Terminal statuses are at the end, so
// LOST/COLD/SPAM are reachable from anywhere forward. Backward moves are not
// legal here — reversal goes through the autonomous-action undo path.
// ponytail: strict-forward only; add an explicit reopen rule if a flow needs
// LOST -> NEW without going through undo.
export function isLegalTransition(from: LeadStatus, to: LeadStatus): boolean {
  return STAGE_ORDER.indexOf(STATUS_TO_STAGE[to]) >= STAGE_ORDER.indexOf(STATUS_TO_STAGE[from]);
}
