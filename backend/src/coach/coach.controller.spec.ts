import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

/**
 * Phase 7's acceptance criterion: a rep may only read their own coaching.
 *
 * This is the rule that decides whether a sales team keeps the tool. It is
 * enforced in the controller rather than the front end, so it is tested here
 * rather than trusted.
 */
describe('CoachController (Phase 7 acceptance)', () => {
  let controller: CoachController;
  let service: any;

  const rep = { id: 'rep-1', tenantId: 't1', role: 'SALES_AGENT' };
  const otherRep = 'rep-2';
  const manager = { id: 'mgr-1', tenantId: 't1', role: 'MANAGER' };

  beforeEach(async () => {
    service = {
      forRep: jest.fn().mockResolvedValue([]),
      adminOverview: jest.fn().mockResolvedValue({ reps: [], teamAvgScore: null, totalCalls: 0 }),
      knowledgeBase: jest.fn().mockResolvedValue([]),
    };

    // The guards are stubbed out on purpose: this suite is about the
    // owner-check inside forRep, which is what stops one rep reading another's
    // scores. Auth itself is covered by the guards' own tests.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoachController],
      providers: [{ provide: CoachService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CoachController);
  });

  it('a rep reading another rep\'s coaching gets 403', () => {
    expect(() => controller.forRep(otherRep, { user: rep })).toThrow(ForbiddenException);
    expect(service.forRep).not.toHaveBeenCalled();
  });

  it('a rep can read their own coaching', async () => {
    await controller.forRep(rep.id, { user: rep });
    expect(service.forRep).toHaveBeenCalledWith('t1', 'rep-1', undefined);
  });

  it('a manager can read any rep, because the comparison view is theirs', async () => {
    await controller.forRep(otherRep, { user: manager });
    expect(service.forRep).toHaveBeenCalledWith('t1', otherRep, undefined);
  });

  it('/coach/me is always scoped to the caller, never to a supplied id', async () => {
    await controller.mine({ user: rep });
    expect(service.forRep).toHaveBeenCalledWith('t1', 'rep-1', undefined);
  });

  it('the admin overview is scoped to the caller\'s tenant', async () => {
    await controller.overview({ user: manager }, '7');
    expect(service.adminOverview).toHaveBeenCalledWith('t1', 7);
  });
});
