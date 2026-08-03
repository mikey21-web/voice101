import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelephonyService } from './telephony.service';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioVoiceAdapter } from '../shared/adapters/voice.adapter';

describe('TelephonyService', () => {
  let service: TelephonyService;
  let prisma: any;
  let voiceAdapter: any;
  let config: any;

  const mockLead = {
    id: 'lead-1',
    tenantId: 'default-tenant',
    contactId: 'contact-1',
    contact: { phone: '+15551234567', name: 'Jane Doe' },
    tenant: { name: 'Acme Corp' },
  };

  beforeEach(async () => {
    prisma = {
      // initiateCall stamps firstContactAttemptedAt for the 30 second SLA clock.
      lead: {
        findUnique: jest.fn().mockResolvedValue(mockLead),
        update: jest.fn().mockResolvedValue(mockLead),
      },
      callLog: { create: jest.fn().mockResolvedValue({ id: 'call-1' }) },
      conversationMessage: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }) },
    };
    voiceAdapter = {
      makeCall: jest.fn().mockResolvedValue({ success: true, callSid: 'CA123' }),
    };
    config = {
      get: jest.fn((key: string, def?: string) => (key === 'TWILIO_PHONE_NUMBER' ? '+15559999999' : def ?? '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelephonyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: TwilioVoiceAdapter, useValue: voiceAdapter },
      ],
    }).compile();

    service = module.get<TelephonyService>(TelephonyService);
  });

  it('returns an error when the lead does not exist', async () => {
    prisma.lead.findUnique.mockResolvedValue(null);
    const result = await service.initiateCall('missing-lead', 'agent-1');
    expect(result).toEqual({ success: false, error: 'Lead not found' });
    expect(voiceAdapter.makeCall).not.toHaveBeenCalled();
  });

  it('returns an error when the contact has no phone number', async () => {
    prisma.lead.findUnique.mockResolvedValue({ ...mockLead, contact: { phone: null } });
    const result = await service.initiateCall('lead-1', 'agent-1');
    expect(result).toEqual({ success: false, error: 'Contact has no phone number' });
    expect(voiceAdapter.makeCall).not.toHaveBeenCalled();
  });

  it('initiates a call via the voice adapter with the lead contact number', async () => {
    await service.initiateCall('lead-1', 'agent-1');
    expect(voiceAdapter.makeCall).toHaveBeenCalledWith(
      '+15551234567',
      expect.objectContaining({ leadName: 'Jane Doe', businessName: 'Acme Corp', record: true }),
    );
  });

  it('creates a CallLog on successful call initiation', async () => {
    await service.initiateCall('lead-1', 'agent-1');
    expect(prisma.callLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'default-tenant',
          leadId: 'lead-1',
          agentId: 'agent-1',
          direction: 'OUTBOUND',
          status: 'INITIATED',
          providerSid: 'CA123',
        }),
      }),
    );
  });

  it('creates a PHONE_CALL conversation message on successful call initiation', async () => {
    await service.initiateCall('lead-1', 'agent-1');
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'PHONE_CALL', direction: 'OUTBOUND', leadId: 'lead-1' }),
      }),
    );
  });

  it('does not create a CallLog or conversation message when the call fails', async () => {
    voiceAdapter.makeCall.mockResolvedValue({ success: false, error: 'Twilio error' });
    await service.initiateCall('lead-1', 'agent-1');
    expect(prisma.callLog.create).not.toHaveBeenCalled();
    expect(prisma.conversationMessage.create).not.toHaveBeenCalled();
  });
});
