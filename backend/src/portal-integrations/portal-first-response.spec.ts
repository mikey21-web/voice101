import { Test, TestingModule } from '@nestjs/testing';
import { PortalIntegrationsService } from './portal-integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { ResolveLeadService } from '../leads/resolve-lead.service';
import { ConversationsService } from '../conversations/conversations.service';

describe('PortalIntegrationsService first-response ack', () => {
  let service: PortalIntegrationsService;
  let prisma: any;
  let leadsService: any;
  let resolveLeadService: any;
  let conversationsService: any;

  const contact = { id: 'contact-1', name: 'Ravi Kumar' };
  const welcomeTemplate = { id: 'tpl-1', type: 'WELCOME', channel: 'WHATSAPP', active: true, body: 'Hi {{name}}, thanks for your interest!' };

  beforeEach(async () => {
    prisma = {
      webhookEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'lead-1', contactId: 'contact-1', tenantId: 't1' }),
      },
      contact: { findUniqueOrThrow: jest.fn().mockResolvedValue(contact) },
      messageTemplate: { findFirst: jest.fn().mockResolvedValue(welcomeTemplate) },
    };
    leadsService = { create: jest.fn().mockResolvedValue({ id: 'lead-1', contactId: 'contact-1' }) };
    resolveLeadService = {
      resolveLead: jest.fn().mockResolvedValue({
        leadId: 'lead-1', contactId: 'contact-1',
        isReturning: false, reusedExistingLead: false,
        segment: 'WARM', assignedRepId: null,
        history: { previousLeads: 0, conversations: 0, callsAnswered: 0, callsMissed: 0, campaigns: [] },
      }),
    };
    conversationsService = { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalIntegrationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: { findOrCreate: jest.fn().mockResolvedValue(contact) } },
        { provide: LeadsService, useValue: leadsService },
        { provide: ResolveLeadService, useValue: resolveLeadService },
        { provide: ConversationsService, useValue: conversationsService },
      ],
    }).compile();

    service = module.get(PortalIntegrationsService);
  });

  it('sends a WhatsApp ack for a brand-new lead when an active WELCOME template exists', async () => {
    await service.handleIndiaMART({ lead_id: 'x1', buyer_name: 'Ravi Kumar', buyer_mobile: '9876543210' });
    await new Promise(process.nextTick); // let the fire-and-forget ack settle
    expect(conversationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'lead-1', channel: 'WHATSAPP', direction: 'OUTBOUND', text: 'Hi Ravi, thanks for your interest!' }),
    );
  });

  it('does not send an ack when no active WELCOME template is configured', async () => {
    prisma.messageTemplate.findFirst.mockResolvedValue(null);
    await service.handleIndiaMART({ lead_id: 'x2', buyer_name: 'Ravi Kumar', buyer_mobile: '9876543210' });
    await new Promise(process.nextTick);
    expect(conversationsService.create).not.toHaveBeenCalled();
  });

  it('does not send an ack when the lead already existed (not a new lead)', async () => {
    // "Already existed" is now resolveLead's call, not a findFirst here.
    resolveLeadService.resolveLead.mockResolvedValue({
      leadId: 'existing-lead', contactId: 'contact-1',
      isReturning: true, reusedExistingLead: true,
      segment: 'WARM', assignedRepId: 'agent-1',
      history: { previousLeads: 1, conversations: 2, callsAnswered: 0, callsMissed: 0, campaigns: [] },
    });
    await service.handleIndiaMART({ lead_id: 'x3', buyer_name: 'Ravi Kumar', buyer_mobile: '9876543210' });
    await new Promise(process.nextTick);
    expect(conversationsService.create).not.toHaveBeenCalled();
  });
});
