import { Test, TestingModule } from '@nestjs/testing';
import { SpineDriverService } from './spine-driver.service';
import { AdvanceStageService } from './advance-stage.service';

/**
 * Section 2's rule: Mikey operates the spine, it does not watch it.
 *
 * Before this, stages 5 to 10 only moved because a person changed a dropdown.
 * These assert that the real business fact moves the lead, and that Mikey is
 * recorded as the actor rather than a human.
 */
describe('SpineDriverService (section 2 acceptance)', () => {
  let service: SpineDriverService;
  let advance: any;

  beforeEach(async () => {
    advance = {
      getLead: jest.fn().mockResolvedValue({ id: 'lead-1', tenantId: 't1', status: 'QUALIFIED' }),
      advanceStage: jest.fn().mockResolvedValue({ from: 'QUALIFIED', to: 'PROPOSAL_SENT', stage: 'MATCH' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SpineDriverService, { provide: AdvanceStageService, useValue: advance }],
    }).compile();

    service = module.get(SpineDriverService);
  });

  const advancedTo = () => advance.advanceStage.mock.calls[0][0];

  it.each([
    ['cost_sheet_created', 'PROPOSAL_SENT'],
    ['unit_hold_created', 'PROPOSAL_SENT'],
    ['site_visit_scheduled', 'APPOINTMENT_BOOKED'],
    ['site_visit_confirmed', 'APPOINTMENT_BOOKED'],
    ['booking_confirmed', 'BOOKED'],
    ['handed_over', 'POSSESSION'],
  ])('%s moves the lead to %s', async (type, expected) => {
    await service.onLifecycleEvent({ type, leadId: 'lead-1' });
    expect(advancedTo().to).toBe(expected);
  });

  it.each([
    ['AGREEMENT_IN_PROGRESS', 'AGREEMENT'],
    ['AGREEMENT_REGISTERED', 'REGISTERED'],
    ['PAYMENT_ACTIVE', 'LOAN_PROCESSING'],
    ['HANDED_OVER', 'POSSESSION'],
  ])('post-sales stage %s moves the lead to %s', async (toStage, expected) => {
    await service.onLifecycleEvent({
      type: 'post_sales_stage_changed',
      leadId: 'lead-1',
      metadata: { toStage },
    });
    expect(advancedTo().to).toBe(expected);
  });

  it('records Mikey as the actor, not a human', async () => {
    await service.onLifecycleEvent({ type: 'booking_confirmed', leadId: 'lead-1' });
    expect(advancedTo().actor).toBe('mikey');
    expect(advancedTo().reason).toContain('booking_confirmed');
  });

  it('ignores lifecycle noise that proves nothing about the stage', async () => {
    for (const type of ['construction_update', 'site_visit_checked_in', 'transfer_requested']) {
      await service.onLifecycleEvent({ type, leadId: 'lead-1' });
    }
    expect(advance.advanceStage).not.toHaveBeenCalled();
  });

  it('ignores an entry with no lead', async () => {
    await service.onLifecycleEvent({ type: 'booking_confirmed' });
    expect(advance.advanceStage).not.toHaveBeenCalled();
  });

  it('a rejected transition never throws at the caller', async () => {
    // A repeat event tries to move backwards; advanceStage rejects it. The
    // booking that produced the entry must not fail because of that.
    advance.advanceStage.mockRejectedValue(new Error('Illegal lead transition BOOKED -> PROPOSAL_SENT'));
    await expect(
      service.onLifecycleEvent({ type: 'cost_sheet_created', leadId: 'lead-1' }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when the lead no longer exists', async () => {
    advance.getLead.mockResolvedValue(null);
    await service.onLifecycleEvent({ type: 'booking_confirmed', leadId: 'gone' });
    expect(advance.advanceStage).not.toHaveBeenCalled();
  });
});
