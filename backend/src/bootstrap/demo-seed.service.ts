import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus, LeadSegment, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CoachService } from '../coach/coach.service';

const PROJECT_NAME = 'Green Valley Heights';
/** Everything this service creates is tagged, so cleanup is exact. */
const DEMO_TAG = 'demo-seed';

interface DemoLead {
  name: string;
  phone: string;
  status: LeadStatus;
  segment: LeadSegment;
  score: number;
  interest: string;
  budget: string;
  /** Present means this lead has a call with a transcript, which the coach scores. */
  transcript?: string;
  durationSec?: number;
}

/**
 * Populates a believable pipeline so the dashboard is not empty in a meeting.
 *
 * An empty dashboard kills a demo faster than a missing feature does. This
 * puts a real project, real units at every status, and leads spread across
 * the spine so every page has something on it: hot leads waiting, a site
 * visit booked, a booking in the money trail, and coached calls of varying
 * quality including one bad one.
 *
 * Idempotent and reversible. Run it, demo, wipe it.
 */
@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private prisma: PrismaService,
    private coach: CoachService,
  ) {}

  private readonly leads: DemoLead[] = [
    {
      name: 'Ramesh Kumar', phone: '+919000000101',
      status: 'QUALIFIED', segment: 'HOT', score: 88,
      interest: '2BHK Kompally', budget: '70-80 lakh',
      durationSec: 245,
      transcript:
        'Agent: Namaskaram, thank you for enquiring about Green Valley Heights. May I know your budget? '
        + 'Buyer: Around 70 to 80 lakh. Agent: Which area do you prefer? Buyer: Kompally, close to my office. '
        + 'Agent: And when are you planning to buy? Buyer: Within 3 months. '
        + 'Agent: Will you be taking a home loan or paying cash? Buyer: Home loan, I bank with SBI. '
        + 'Agent: I have two 2BHK units open in your range. Can I book a site visit this Sunday? '
        + 'Buyer: Yes Sunday morning works.',
    },
    {
      name: 'Anitha Reddy', phone: '+919000000102',
      status: 'APPOINTMENT_BOOKED', segment: 'HOT', score: 92,
      interest: '3BHK Kompally', budget: '1.1 crore',
      durationSec: 310,
      transcript:
        'Agent: Thanks for visiting our page. What kind of home are you looking for? '
        + 'Buyer: A 3BHK, budget about 1.1 crore. Agent: Which location suits you? Buyer: Kompally or Medchal. '
        + 'Agent: Timeline? Buyer: We want possession within a year. Agent: Loan or cash? Buyer: Mostly cash, small loan. '
        + 'Buyer: Can I see the floor plan and visit the site? Agent: I will confirm Saturday 11am. Buyer: Perfect.',
    },
    {
      name: 'Srinivas Rao', phone: '+919000000103',
      status: 'QUALIFYING', segment: 'WARM', score: 54,
      interest: '2BHK', budget: '60 lakh',
      durationSec: 95,
      // Deliberately weak: the rep talked, never asked, missed a buying signal.
      transcript:
        'Agent: Sir our project is very good, we have clubhouse, swimming pool, gym, kids play area, '
        + 'and 24 hour security with power backup. Buyer: Okay. Is anything available on a higher floor? '
        + 'Agent: Yes sir many options. Our amenities are the best in the area. Buyer: Okay I will think.',
    },
    {
      name: 'Fatima Begum', phone: '+919000000104',
      status: 'PROPOSAL_SENT', segment: 'WARM', score: 71,
      interest: '2BHK', budget: '75 lakh',
      durationSec: 180,
      transcript:
        'Agent: What is your budget? Buyer: About 75 lakh. Agent: Preferred area? Buyer: Kompally. '
        + 'Agent: When are you looking to move? Buyer: Next 6 months. Agent: Loan or cash? Buyer: Loan. '
        + 'Buyer: Honestly this is too expensive compared to the other builder we saw. '
        + 'Agent: I understand, let me send you the payment plan so you can see the monthly outgo.',
    },
    { name: 'Vikram Shetty', phone: '+919000000105', status: 'BOOKED', segment: 'HOT', score: 95, interest: '3BHK', budget: '1.2 crore' },
    { name: 'Priya Menon', phone: '+919000000106', status: 'LOAN_PROCESSING', segment: 'EXISTING_CUSTOMER', score: 90, interest: '2BHK', budget: '80 lakh' },
    { name: 'Arjun Nair', phone: '+919000000107', status: 'NEW', segment: 'WARM', score: 20, interest: '2BHK', budget: '65 lakh' },
    { name: 'Deepa Sharma', phone: '+919000000108', status: 'NEW', segment: 'HOT', score: 60, interest: '3BHK', budget: '1 crore' },
    { name: 'Mohan Babu', phone: '+919000000109', status: 'CONTACTED', segment: 'WARM', score: 40, interest: '2BHK', budget: '70 lakh' },
    { name: 'Lakshmi Devi', phone: '+919000000110', status: 'LOST', segment: 'RECONNECT', score: 15, interest: '2BHK', budget: '55 lakh' },
  ];

  async seed(tenantId: string, agentId: string): Promise<{ projectId: string; units: number; leads: number; coached: number }> {
    await this.wipe(tenantId);

    const project = await this.prisma.project.create({
      data: {
        tenantId, name: PROJECT_NAME,
        description: 'Demo project seeded for walkthroughs. Safe to delete.',
        location: 'Kompally, Hyderabad',
        address: 'Survey 42, Kompally, Hyderabad 500014',
        reraId: `DEMO-RERA-${Date.now().toString(36)}`,
        possessionDate: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
      },
    });

    const tower = await this.prisma.tower.create({
      data: { projectId: project.id, name: 'Tower A', totalFloors: 12 },
    });

    // A mix of statuses, because a demo where everything is available looks fake
    // and hides the whole point of live inventory.
    const units: { unitNumber: string; floor: number; unitType: string; areaSqft: number; price: number; status: UnitStatus }[] = [];
    for (let floor = 1; floor <= 10; floor++) {
      for (const [idx, type] of ['2BHK', '3BHK'].entries()) {
        const n = floor * 100 + idx + 1;
        units.push({
          unitNumber: `A-${n}`,
          floor,
          unitType: type,
          areaSqft: type === '2BHK' ? 1180 : 1620,
          price: type === '2BHK' ? 7_800_000 : 11_500_000,
          status: n % 7 === 0 ? UnitStatus.SOLD : n % 5 === 0 ? UnitStatus.ON_HOLD : UnitStatus.AVAILABLE,
        });
      }
    }
    await this.prisma.unit.createMany({
      data: units.map((u) => ({ ...u, tenantId, projectId: project.id, towerId: tower.id })),
    });

    let coached = 0;
    for (const l of this.leads) {
      const contact = await this.prisma.contact.create({
        data: { tenantId, name: l.name, phone: l.phone, whatsapp: l.phone, tags: [DEMO_TAG] },
      });
      const lead = await this.prisma.lead.create({
        data: {
          tenantId, contactId: contact.id, assignedAgentId: agentId,
          source: 'FORM', status: l.status, segment: l.segment, score: l.score,
          interest: l.interest, budget: l.budget, tags: [DEMO_TAG],
          metadata: { demoSeed: true, touches: [{ source: 'FORM', at: new Date().toISOString() }] },
        },
      });

      if (l.transcript) {
        const call = await this.prisma.callLog.create({
          data: {
            tenantId, leadId: lead.id, contactId: contact.id, agentId,
            direction: 'OUTBOUND', status: 'COMPLETED',
            fromNumber: '+914000000000', toNumber: l.phone,
            durationSec: l.durationSec, transcript: l.transcript,
            summary: `Call with ${l.name} about ${l.interest}.`,
            summaryStatus: 'DONE',
          },
        });
        await this.coach.coachCall(call.id).catch((e) =>
          this.logger.warn(`Demo coaching failed for ${l.name}: ${e.message}`),
        );
        coached++;
      }
    }

    this.logger.log(`Demo seeded: ${units.length} units, ${this.leads.length} leads, ${coached} coached calls`);
    return { projectId: project.id, units: units.length, leads: this.leads.length, coached };
  }

  /** Removes everything seed() created, in FK-safe order. */
  async wipe(tenantId: string): Promise<{ leads: number }> {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, tags: { has: DEMO_TAG } },
      select: { id: true, contactId: true },
    });
    const leadIds = leads.map((l) => l.id);
    const contactIds = leads.map((l) => l.contactId).filter((c): c is string => !!c);

    if (leadIds.length) {
      await this.prisma.callCoaching.deleteMany({ where: { leadId: { in: leadIds } } });
      await this.prisma.leadEscalation.deleteMany({ where: { leadId: { in: leadIds } } });
      await this.prisma.scheduledAction.deleteMany({ where: { leadId: { in: leadIds } } });
      await this.prisma.mikeyAutonomousAction.deleteMany({ where: { leadId: { in: leadIds } } });
      await this.prisma.timelineItem.deleteMany({ where: { leadId: { in: leadIds } } });
      await this.prisma.callLog.deleteMany({ where: { leadId: { in: leadIds } } });
      await this.prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    }
    if (contactIds.length) {
      await this.prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
    }

    const project = await this.prisma.project.findFirst({ where: { tenantId, name: PROJECT_NAME } });
    if (project) {
      await this.prisma.unit.deleteMany({ where: { projectId: project.id } });
      await this.prisma.tower.deleteMany({ where: { projectId: project.id } });
      await this.prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    }

    return { leads: leadIds.length };
  }
}
