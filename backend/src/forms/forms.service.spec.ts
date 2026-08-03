import { Test, TestingModule } from '@nestjs/testing';
import { FormsService } from './forms.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AgentClientService } from '../agent/agent-client.service';
import { ResolveLeadService } from '../leads/resolve-lead.service';
import { NotFoundException } from '@nestjs/common';

describe('FormsService', () => {
  let service: FormsService;
  let prisma: any;
  let contactsService: any;
  let leadsService: any;
  let resolveLeadService: any;
  let auditLogs: any;
  let conversationsService: any;
  let agentClient: any;

  const mockForm = {
    id: 'form-1',
    name: 'Contact Us',
    description: 'Main contact form',
    active: true,
    tenantId: 'default-tenant',
    steps: [
      { id: 'step-1', title: 'Personal Info', description: 'Your details' },
      { id: 'step-2', title: 'Preferences', description: 'Tell us more' },
    ],
    embedConfig: { type: 'inline', theme: {} },
    submissionConfig: { redirectUrl: '/thank-you', confirmationMessage: 'Thanks!' },
    formType: 'custom',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    fields: [
      {
        id: 'field-1',
        formId: 'form-1',
        label: 'Full Name',
        fieldKey: 'name',
        type: 'text',
        required: true,
        displayOrder: 1,
        stepId: 'step-1',
        description: 'Enter your full legal name',
        width: 'full',
        conditionalLogic: {},
        options: null,
        placeholder: 'Enter your name',
        defaultValue: null,
        validation: {},
      },
      {
        id: 'field-2',
        formId: 'form-1',
        label: 'Email',
        fieldKey: 'email',
        type: 'email',
        required: true,
        displayOrder: 2,
        stepId: 'step-1',
        description: null,
        width: 'full',
        conditionalLogic: {},
        options: null,
        placeholder: 'Enter your email',
        defaultValue: null,
        validation: {},
      },
      {
        id: 'field-3',
        formId: 'form-1',
        label: 'Interest',
        fieldKey: 'interest',
        type: 'select',
        required: false,
        displayOrder: 3,
        stepId: 'step-2',
        description: null,
        width: 'half',
        conditionalLogic: {},
        options: ['Product A', 'Product B'],
        placeholder: null,
        defaultValue: null,
        validation: {},
      },
    ],
  };

  const mockContact = {
    id: 'contact-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    whatsapp: null,
    company: 'Acme Inc',
  };

  const mockLead = {
    id: 'lead-1',
    contactId: 'contact-1',
    source: 'FORM',
    status: 'NEW',
  };

  const mockField = {
    id: 'field-4',
    formId: 'form-1',
    label: 'Phone',
    fieldKey: 'phone',
    type: 'tel',
    required: false,
    displayOrder: 4,
    stepId: 'step-1',
    width: 'full',
    conditionalLogic: {},
    description: null,
  };

  const mockSubmission = {
    id: 'sub-1',
    formId: 'form-1',
    leadId: 'lead-1',
    payload: { name: 'John', email: 'john@example.com' },
    source: 'direct',
    pageUrl: null,
    utm: {},
    completed: true,
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    lead: {
      id: 'lead-1',
      contact: { ...mockContact },
    },
  };

  const mockPartialSubmission = {
    id: 'sub-2',
    formId: 'form-1',
    leadId: 'lead-1',
    payload: { name: 'Partial' },
    source: 'embed',
    pageUrl: 'https://example.com/form',
    utm: { source: 'google', medium: 'cpc' },
    completed: false,
    startedAt: new Date('2025-01-02T10:00:00Z'),
    completedAt: null,
    createdAt: new Date('2025-01-02T10:05:00Z'),
    lead: {
      id: 'lead-1',
      contact: { ...mockContact },
    },
  };

  beforeEach(async () => {
    prisma = {
      leadForm: {
        findMany: jest.fn().mockResolvedValue([mockForm]),
        findUnique: jest.fn().mockResolvedValue(mockForm),
        create: jest.fn().mockResolvedValue(mockForm),
        update: jest.fn().mockResolvedValue(mockForm),
      },
      leadFormField: {
        create: jest.fn().mockResolvedValue(mockField),
        update: jest.fn().mockResolvedValue(mockField),
        delete: jest.fn().mockResolvedValue(mockField),
      },
      lead: { findUniqueOrThrow: jest.fn().mockResolvedValue(mockLead) },
      formSubmission: {
        create: jest.fn().mockResolvedValue(mockSubmission),
        findMany: jest.fn().mockResolvedValue([mockSubmission]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([
          { source: 'direct', _count: { source: 1 } },
        ]),
      },
      qrCode: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    contactsService = {
      findOrCreate: jest.fn().mockResolvedValue(mockContact),
    };

    leadsService = {
      create: jest.fn().mockResolvedValue(mockLead),
    };

    resolveLeadService = {
      resolveLead: jest.fn().mockResolvedValue({
        leadId: mockLead.id, contactId: 'contact-1',
        isReturning: false, reusedExistingLead: false,
        segment: 'WARM', assignedRepId: null,
        history: { previousLeads: 0, conversations: 0, callsAnswered: 0, callsMissed: 0, campaigns: [] },
      }),
    };

    auditLogs = {
      log: jest.fn().mockResolvedValue({}),
    };

    conversationsService = {
      create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    agentClient = {
      trigger: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contactsService },
        { provide: LeadsService, useValue: leadsService },
        { provide: ResolveLeadService, useValue: resolveLeadService },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: ConversationsService, useValue: conversationsService },
        { provide: AgentClientService, useValue: agentClient },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
  });

  // ── findAll ─────────────────────────────────────

  it('should find all forms with fields ordered by displayOrder', async () => {
    const forms = await service.findAll();
    expect(forms).toHaveLength(1);
    expect(forms[0].fields).toHaveLength(3);
    expect(prisma.leadForm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { fields: { orderBy: { displayOrder: 'asc' } } },
      }),
    );
  });

  it('should return empty array when no forms exist', async () => {
    prisma.leadForm.findMany.mockResolvedValue([]);
    const result = await service.findAll();
    expect(result).toEqual([]);
  });

  // ── findOne ─────────────────────────────────────

  it('should find a form by id with fields', async () => {
    const form = await service.findOne('form-1');
    expect(form.id).toBe('form-1');
    expect(form.name).toBe('Contact Us');
    expect(form.fields[0].label).toBe('Full Name');
  });

  it('should throw NotFoundException when form not found', async () => {
    prisma.leadForm.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ── findOnePublic ───────────────────────────────

  it('should return form config for public embed (no auth)', async () => {
    const form = await service.findOnePublic('form-1');
    expect(form.id).toBe('form-1');
    expect(form.name).toBe('Contact Us');
    expect(form.fields).toHaveLength(3);
    expect(form.steps).toBeDefined();
    expect(form.embedConfig).toBeDefined();
  });

  it('should throw NotFoundException when public form not found', async () => {
    prisma.leadForm.findUnique.mockResolvedValue(null);
    await expect(service.findOnePublic('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ── create ──────────────────────────────────────

  it('should create a form and log audit', async () => {
    const form = await service.create({ name: 'Contact Us', active: true, formType: 'custom' }, 'user-1');
    expect(form.name).toBe('Contact Us');
    expect(auditLogs.log).toHaveBeenCalledWith('form_created', 'LeadForm', form.id, 'user-1');
  });

  it('should create a form without userId', async () => {
    await service.create({ name: 'Newsletter Signup' });
    expect(auditLogs.log).toHaveBeenCalledWith('form_created', 'LeadForm', mockForm.id, undefined);
  });

  // ── update ──────────────────────────────────────

  it('should update a form and log audit', async () => {
    prisma.leadForm.update.mockResolvedValue({ ...mockForm, name: 'Updated Form' });
    const form = await service.update('form-1', { name: 'Updated Form' }, 'user-1');
    expect(form.name).toBe('Updated Form');
    expect(auditLogs.log).toHaveBeenCalledWith('form_updated', 'LeadForm', 'form-1', 'user-1');
  });

  it('should throw NotFoundException when updating non-existent form', async () => {
    prisma.leadForm.findUnique.mockResolvedValue(null);
    await expect(service.update('nonexistent', { name: 'Nope' })).rejects.toThrow(NotFoundException);
  });

  it('should call findOne before update to verify existence', async () => {
    await service.update('form-1', { name: 'Renamed' });
    expect(prisma.leadForm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'form-1' } }),
    );
  });

  // ── addField ────────────────────────────────────

  it('should add a field to a form', async () => {
    const field = await service.addField('form-1', {
      label: 'Phone',
      fieldKey: 'phone',
      type: 'tel',
      displayOrder: 4,
    });
    expect(field.label).toBe('Phone');
    expect(field.formId).toBe('form-1');
    expect(prisma.leadFormField.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ label: 'Phone', formId: 'form-1' }),
      }),
    );
  });

  it('should add a field with all optional properties including multi-step fields', async () => {
    await service.addField('form-1', {
      label: 'Company',
      fieldKey: 'company',
      type: 'text',
      required: true,
      placeholder: 'Your company',
      description: 'Company name',
      displayOrder: 5,
      stepId: 'step-1',
      width: 'half',
      conditionalLogic: { action: 'show', conditions: [] },
      options: ['Tech', 'Finance'],
    });
    expect(prisma.leadFormField.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: 'Company',
          required: true,
          placeholder: 'Your company',
          description: 'Company name',
          stepId: 'step-1',
          width: 'half',
          conditionalLogic: { action: 'show', conditions: [] },
          formId: 'form-1',
        }),
      }),
    );
  });

  // ── updateField ─────────────────────────────────

  it('should update a field', async () => {
    prisma.leadFormField.update.mockResolvedValue({ ...mockField, label: 'Phone Number' });
    const field = await service.updateField('form-1', 'field-4', { label: 'Phone Number' });
    expect(prisma.leadFormField.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'field-4' },
        data: { label: 'Phone Number' },
      }),
    );
  });

  // ── deleteField ─────────────────────────────────

  it('should delete a field', async () => {
    await service.deleteField('form-1', 'field-4');
    expect(prisma.leadFormField.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'field-4' } }),
    );
  });

  // ── submit ──────────────────────────────────────

  it('should process a form submission creating contact, lead, and submission record', async () => {
    const payload = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      message: 'Interested in your services',
    };
    const result = await service.submit('form-1', payload, {});

    // Phase 4: contact + lead now go through the one resolve path, so the same
    // buyer arriving by form and by portal is a single lead on a single rep.
    expect(resolveLeadService.resolveLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        source: 'FORM',
        message: 'Interested in your services',
        metadata: payload,
      }),
    );

    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formId: 'form-1',
          payload,
          leadId: 'lead-1',
          source: 'direct',
          completed: false,
        }),
      }),
    );

    expect(auditLogs.log).toHaveBeenCalledWith('form_submitted', 'LeadForm', 'form-1');
    expect(result.data.lead.id).toBe('lead-1');
    expect(result.data.contact.id).toBe('contact-1');
  });

  it('should pass optional whatsapp and company fields through to resolve', async () => {
    const payload = {
      name: 'Jane',
      email: 'jane@example.com',
      phone: '+1987654321',
      whatsapp: '+1987654321',
      company: 'Corp',
    };
    await service.submit('form-1', payload, {});
    expect(resolveLeadService.resolveLead).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp: '+1987654321',
        company: 'Corp',
      }),
    );
  });

  it('should throw NotFoundException when submitting to non-existent form', async () => {
    prisma.leadForm.findUnique.mockResolvedValue(null);
    await expect(service.submit('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
  });

  it('should include interest in lead creation', async () => {
    const payload = { name: 'Test', email: 'test@test.com', interest: 'Premium Plan' };
    await service.submit('form-1', payload, {});
    expect(resolveLeadService.resolveLead).toHaveBeenCalledWith(
      expect.objectContaining({
        interest: 'Premium Plan',
      }),
    );
  });

  it('should use formId from findOne in the submission', async () => {
    await service.submit('form-1', { name: 'Test', email: 'test@test.com' }, {});
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ formId: 'form-1' }),
      }),
    );
  });

  // ── Submit — submission metadata ─────────────────

  it('should store submission metadata (source, pageUrl, utm) and strip prefixed keys from payload', async () => {
    const payload = {
      name: 'John',
      email: 'john@test.com',
      _source: 'embed',
      _pageUrl: 'https://example.com/landing',
      _utm: { source: 'google', medium: 'cpc' },
      _startedAt: '2025-01-01T10:00:00Z',
      _completedAt: '2025-01-01T10:05:00Z',
    };

    await service.submit('form-1', payload, {});

    // Clean payload should NOT include prefixed meta keys
    const createdCall = prisma.formSubmission.create.mock.calls[0][0];
    expect(createdCall.data.payload).toEqual({
      name: 'John',
      email: 'john@test.com',
    });
    expect(createdCall.data.payload._source).toBeUndefined();
    expect(createdCall.data.payload._utm).toBeUndefined();

    // Submission metadata fields
    expect(createdCall.data.source).toBe('embed');
    expect(createdCall.data.pageUrl).toBe('https://example.com/landing');
    expect(createdCall.data.utm).toEqual({ source: 'google', medium: 'cpc' });
    expect(createdCall.data.completed).toBe(true);
    expect(createdCall.data.startedAt).toEqual(new Date('2025-01-01T10:00:00Z'));
    expect(createdCall.data.completedAt).toEqual(new Date('2025-01-01T10:05:00Z'));
  });

  it('should handle partial submissions with completed=false when _completedAt is absent', async () => {
    const payload = {
      name: 'Partial',
      email: 'partial@test.com',
      _source: 'embed',
      _pageUrl: 'https://example.com/form',
      _startedAt: '2025-01-02T10:00:00Z',
    };

    await service.submit('form-1', payload, {});

    const createdCall = prisma.formSubmission.create.mock.calls[0][0];
    expect(createdCall.data.completed).toBe(false);
    expect(createdCall.data.completedAt).toBeNull();
    expect(createdCall.data.startedAt).toEqual(new Date('2025-01-02T10:00:00Z'));
    expect(createdCall.data.source).toBe('embed');
  });

  it('should default source to "direct" when _source is not provided', async () => {
    await service.submit('form-1', { name: 'Test', email: 'test@test.com' }, {});
    const createdCall = prisma.formSubmission.create.mock.calls[0][0];
    expect(createdCall.data.source).toBe('direct');
  });

  // ── QR attribution ──────────────────────────────

  it('should attribute the lead to QR_CODE when a valid qrCodeId is submitted', async () => {
    prisma.qrCode.findUnique.mockResolvedValue({ id: 'qr-1' });
    await service.submit('form-1', { name: 'Test', email: 'test@test.com', qrCodeId: 'qr-1' }, {});
    expect(prisma.qrCode.findUnique).toHaveBeenCalledWith({ where: { id: 'qr-1' } });
    expect(resolveLeadService.resolveLead).toHaveBeenCalledWith(expect.objectContaining({ source: 'QR_CODE' }));
  });

  it('should fall back to FORM when the submitted qrCodeId does not exist', async () => {
    prisma.qrCode.findUnique.mockResolvedValue(null);
    await service.submit('form-1', { name: 'Test', email: 'test@test.com', qrCodeId: 'bogus' }, {});
    expect(resolveLeadService.resolveLead).toHaveBeenCalledWith(expect.objectContaining({ source: 'FORM' }));
  });

  // ── findSubmissions ─────────────────────────────

  it('should return paginated submissions with lead and contact info', async () => {
    prisma.formSubmission.findMany.mockResolvedValue([mockSubmission, mockPartialSubmission]);
    prisma.formSubmission.count.mockResolvedValue(2);

    const result = await service.findSubmissions('form-1', { page: 1, limit: 20 });

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId: 'form-1' },
        skip: 0,
        take: 20,
        include: { lead: { include: { contact: true } } },
      }),
    );
  });

  it('should respect page and limit parameters', async () => {
    prisma.formSubmission.findMany.mockResolvedValue([mockSubmission]);
    prisma.formSubmission.count.mockResolvedValue(5);

    await service.findSubmissions('form-1', { page: 2, limit: 10 });

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('should filter by source', async () => {
    prisma.formSubmission.findMany.mockResolvedValue([mockPartialSubmission]);
    prisma.formSubmission.count.mockResolvedValue(1);

    await service.findSubmissions('form-1', { source: 'embed' });

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ formId: 'form-1', source: 'embed' }),
      }),
    );
  });

  it('should filter by completion status', async () => {
    await service.findSubmissions('form-1', { completed: 'true' });

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ formId: 'form-1', completed: true }),
      }),
    );
  });

  it('should filter by date range', async () => {
    await service.findSubmissions('form-1', {
      dateFrom: '2025-01-01T00:00:00Z',
      dateTo: '2025-01-31T23:59:59Z',
    });

    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          formId: 'form-1',
          createdAt: {
            gte: new Date('2025-01-01T00:00:00Z'),
            lte: new Date('2025-01-31T23:59:59Z'),
          },
        }),
      }),
    );
  });

  it('should throw NotFoundException when form does not exist for findSubmissions', async () => {
    prisma.leadForm.findUnique.mockResolvedValue(null);
    await expect(service.findSubmissions('nonexistent', {}))
      .rejects.toThrow(NotFoundException);
  });

  // ── getAnalytics ────────────────────────────────

  it('should return analytics with total submissions and completion rate', async () => {
    prisma.formSubmission.count
      .mockResolvedValueOnce(10)  // totalSubmissions
      .mockResolvedValueOnce(7);  // completedCount
    prisma.formSubmission.groupBy.mockResolvedValue([
      { source: 'direct', _count: { source: 5 } },
      { source: 'embed', _count: { source: 3 } },
      { source: 'api', _count: { source: 2 } },
    ]);
    prisma.formSubmission.findMany
      .mockResolvedValueOnce([])   // field drop-off: empty payloads list
      .mockResolvedValueOnce([     // trends: recent submissions
        { createdAt: new Date('2025-07-15T10:00:00Z'), completed: true },
        { createdAt: new Date('2025-07-15T11:00:00Z'), completed: false },
        { createdAt: new Date('2025-07-16T09:00:00Z'), completed: true },
      ]);

    const analytics = await service.getAnalytics('form-1');

    expect(analytics.totalSubmissions).toBe(10);
    expect(analytics.completionRate).toBe(70);
    expect(analytics.sourceBreakdown).toEqual([
      { source: 'direct', count: 5 },
      { source: 'embed', count: 3 },
      { source: 'api', count: 2 },
    ]);
  });

  it('should return 0 completion rate when there are no submissions', async () => {
    prisma.formSubmission.count
      .mockResolvedValueOnce(0)   // totalSubmissions
      .mockResolvedValueOnce(0);  // completedCount
    prisma.formSubmission.groupBy.mockResolvedValue([]);
    prisma.formSubmission.findMany
      .mockResolvedValueOnce([])  // field drop-off
      .mockResolvedValueOnce([]); // trends

    const analytics = await service.getAnalytics('form-1');

    expect(analytics.totalSubmissions).toBe(0);
    expect(analytics.completionRate).toBe(0);
    expect(analytics.sourceBreakdown).toEqual([]);
    expect(analytics.trends).toEqual([]);
  });

  it('should compute field drop-off for multi-step forms', async () => {
    prisma.formSubmission.count
      .mockResolvedValueOnce(3)   // totalSubmissions
      .mockResolvedValueOnce(2);  // completedCount
    prisma.formSubmission.groupBy.mockResolvedValue([
      { source: 'direct', _count: { source: 3 } },
    ]);
    // Payloads for field drop-off analysis
    prisma.formSubmission.findMany
      .mockResolvedValueOnce([
        { payload: { name: 'A', email: 'a@test.com', interest: 'Product A' } },
        { payload: { name: 'B', email: 'b@test.com' } },
        { payload: { name: 'C', email: 'c@test.com', interest: 'Product B' } },
      ])
      .mockResolvedValueOnce([    // trends (last 30 days)
        { createdAt: new Date(), completed: true },
      ]);

    const analytics = await service.getAnalytics('form-1');

    // step-1 has field keys 'name', 'email' → all 3 submissions have at least one
    expect(analytics.fieldDropOff['step-1']).toBe(3);
    // step-2 has field key 'interest' → 2 submissions have it
    expect(analytics.fieldDropOff['step-2']).toBe(2);
  });

  it('should throw NotFoundException when form does not exist for getAnalytics', async () => {
    prisma.leadForm.findUnique.mockResolvedValue(null);
    await expect(service.getAnalytics('nonexistent'))
      .rejects.toThrow(NotFoundException);
  });
});
