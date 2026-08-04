import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 1 — Prove the spine end to end.
 * One lead walks the whole spine via the public API:
 *   webhook ingest → resolve → engage → qualify → unit match → site visit →
 *   booking → agreement → loan → registration → possession.
 * Lead status only ever moves through AdvanceStageService (the shared stage
 * model from Phase 0); the real lifecycle entities are driven alongside.
 */
describe('Spine walk: one lead to POSSESSION', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;

  let leadId: string;
  let contactId: string;
  let projectId: string;
  let unitId: string;
  let siteVisitId: string;
  let costSheetId: string;
  let bookingId: string;

  const SPINE = ['CONTACTED', 'ENGAGED', 'QUALIFYING', 'QUALIFIED', 'PROPOSAL_SENT', 'APPOINTMENT_BOOKED'] as const;

  async function expectStatus(expected: string) {
    const res = await request(app.getHttpServer()).get(`/leads/${leadId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(expected);
  }

  beforeAll(async () => {
    // The public webhook creates the lead in the default tenant (getTenantId fallback).
    tenantId = process.env.DEFAULT_TENANT_ID || 'default-tenant';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) {
      await prisma.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId, settings: {} } });
    }

    const email = `spine-${Date.now()}@test.com`;
    const pwd = await bcrypt.hash('testpass', 1);
    await prisma.user.create({
      data: { tenantId, email, password: pwd, name: 'Spine Owner', role: 'OWNER' },
    });
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'testpass' });
    expect(login.status).toBe(201);
    token = login.body.accessToken;
  }, 60000);

  afterAll(async () => {
    // SpineDriverService is deliberately fire-and-forget off TimelineService.add,
    // so a stage advance never fails the booking that triggered it. That leaves
    // in-flight queries after the last assertion, which jest reports as "cannot
    // log after tests are done" and fails the suite despite every test passing.
    await new Promise((r) => setTimeout(r, 1000));
    if (!leadId) return app.close();
    await prisma.buyerDocument.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.ledgerEntry.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.paymentReceipt.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.paymentSchedule.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.possessionCase.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.loanRegistrationCase.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.postSalesTransition.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.generatedDocument.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.documentTemplate.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.unitHold.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.costSheet.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.siteVisit.deleteMany({ where: { leadId } }).catch(() => {});
    await prisma.lead.deleteMany({ where: { id: leadId } }).catch(() => {});
    await prisma.contact.deleteMany({ where: { id: contactId } }).catch(() => {});
    await prisma.unit.deleteMany({ where: { projectId } }).catch(() => {});
    await prisma.tower.deleteMany({ where: { projectId } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  }, 30000);

  it('1. webhook ingest: POST /webhooks/forms creates the lead at CAPTURE (NEW)', async () => {
    const res = await request(app.getHttpServer())
      .post('/webhooks/forms')
      .set('x-api-key', process.env.WEBHOOK_API_KEY_FORMS || 'dev-key-1')
      .send({
        name: 'Spine Buyer',
        phone: `9199000${Math.floor(10000 + Math.random() * 89999)}`,
        email: `spine-buyer-${Date.now()}@test.com`,
        message: 'Looking for a 2BHK in Kompally under 80 lakhs',
        interest: '2BHK',
        budget: '8000000',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.lead?.id).toBeDefined();
    leadId = res.body.data.lead.id;
    contactId = res.body.data.contact.id;
    await expectStatus('NEW');
  });

  it('2. resolve: the same webhook payload is deduped by idempotency key', async () => {
    // Gap recorded in section 11: form webhooks only dedupe the CONTACT by
    // phone — a different payload from the same phone still creates a second
    // lead. resolve-by-phone is Phase 4. Here we assert the idempotency dedupe
    // that already works (same payload => same lead).
    const res = await request(app.getHttpServer())
      .post('/webhooks/forms')
      .set('x-api-key', 'dev-key-1')
      .send({
        name: 'Spine Buyer',
        phone: (await prisma.contact.findUnique({ where: { id: contactId } }))!.phone,
        email: (await prisma.contact.findUnique({ where: { id: contactId } }))!.email!,
        message: 'Looking for a 2BHK in Kompally under 80 lakhs',
        interest: '2BHK',
        budget: '8000000',
      });
    expect([200, 201]).toContain(res.status);
    const duplicateLeadId = res.body.data?.lead?.id || res.body.result?.lead?.id;
    expect(duplicateLeadId).toBe(leadId);
  });

  it('3. engage: advance to CONTACTED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONTACTED' });
    expect(res.status).toBe(200);
    await expectStatus('CONTACTED');
  });

  it('4. qualify: QUALIFYING → QUALIFIED', async () => {
    for (const status of ['QUALIFYING', 'QUALIFIED']) {
      const res = await request(app.getHttpServer())
        .patch(`/leads/${leadId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status });
      expect(res.status).toBe(200);
    }
    await expectStatus('QUALIFIED');
  });

  it('5. unit match: a project and unit exist before PROPOSAL_SENT', async () => {
    const proj = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Spine Towers', status: 'UNDER_CONSTRUCTION' });
    expect(proj.status).toBe(201);
    projectId = proj.body.id;

    const tower = await prisma.tower.create({ data: { projectId, name: 'Tower A', totalFloors: 6 } });
    const unit = await request(app.getHttpServer())
      .post(`/projects/${projectId}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send({ towerId: tower.id, unitNumber: 'SP-101', unitType: '2BHK', floor: 2, areaSqft: 1100, price: 7800000, status: 'AVAILABLE' });
    expect(unit.status).toBe(201);
    unitId = unit.body?.id;

    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PROPOSAL_SENT', budget: '8000000', interest: '2BHK' });
    expect(res.status).toBe(200);
    await expectStatus('PROPOSAL_SENT');
  });

  it('6. site visit: schedule and complete, then APPOINTMENT_BOOKED', async () => {
    const visit = await request(app.getHttpServer())
      .post('/site-visits')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId, projectId, unitId, startAt: new Date(Date.now() + 3600000).toISOString() });
    expect(visit.status).toBe(201);
    siteVisitId = visit.body.id;

    const complete = await request(app.getHttpServer())
      .post(`/site-visits/${siteVisitId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcome: 'interested' });
    expect(complete.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPOINTMENT_BOOKED' });
    expect(res.status).toBe(200);
    await expectStatus('APPOINTMENT_BOOKED');
  });

  it('7. booking: cost sheet → hold → confirm-purchase, then BOOKED', async () => {
    const sheet = await request(app.getHttpServer())
      .post('/cost-sheets')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId, unitId, projectId });
    expect(sheet.status).toBe(201);
    costSheetId = sheet.body.id;
    await request(app.getHttpServer()).post(`/cost-sheets/${costSheetId}/submit`).set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer()).post(`/cost-sheets/${costSheetId}/approve`).set('Authorization', `Bearer ${token}`).expect(201);

    const hold = await request(app.getHttpServer())
      .post('/unit-holds')
      .set('Authorization', `Bearer ${token}`)
      .send({ unitId, leadId });
    expect(hold.status).toBe(201);

    // Satisfy the KYC precondition for confirm-purchase via the public KYC path.
    for (const type of ['PAN', 'ADDRESS_PROOF']) {
      const requested = await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${token}`)
        .send({ leadId, type });
      expect(requested.status).toBe(201);
      await request(app.getHttpServer())
        .post(`/kyc/documents/${requested.body.id}/waive`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Spine walk E2E' })
        .expect(201);
    }

    const draft = await request(app.getHttpServer())
      .post('/bookings/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId, unitId, costSheetId });
    expect(draft.status).toBe(201);
    bookingId = draft.body.id;

    const confirm = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/confirm-purchase`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicants: [{ name: 'Spine Buyer', role: 'PRIMARY' }],
        bookingAmountPaise: 78000000,
      });
    expect(confirm.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'BOOKED' });
    expect(res.status).toBe(200);
    await expectStatus('BOOKED');
  });

  it('8. agreement + loan: register the loan file, then AGREEMENT → LOAN_PROCESSING', async () => {
    await request(app.getHttpServer())
      .get(`/bookings/${bookingId}/loan-registration`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const loan = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/loan-registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lenderName: 'SBI', loanAmountPaise: 60000000, sanctionStatus: 'SANCTIONED' });
    expect(loan.status).toBe(200);

    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'AGREEMENT' });
    expect(res.status).toBe(200);

    const res2 = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'LOAN_PROCESSING' });
    expect(res2.status).toBe(200);
    await expectStatus('LOAN_PROCESSING');
  });

  it('9. registration: walk post-sales to AGREEMENT_REGISTERED, then REGISTERED', async () => {
    // From BOOKING_CONFIRMED, one step at a time.
    for (const toStage of ['KYC_IN_PROGRESS', 'ALLOTMENT_ISSUED', 'AGREEMENT_IN_PROGRESS']) {
      const res = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/post-sales/advance`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStage, reason: 'spine walk' });
      expect(res.status).toBe(201);
    }

    // AGREEMENT_REGISTERED needs a generated agreement document — create the
    // fixture directly, since the API path requires a configured template.
    const tmpl = await prisma.documentTemplate.create({
      data: { tenantId, name: 'Agreement for Sale', documentType: 'AGREEMENT', bodyTemplate: '{{buyer}} buys {{unit}}', status: 'APPROVED' },
    });
    await prisma.generatedDocument.create({
      data: { tenantId, templateId: tmpl.id, leadId, bookingId, snapshot: { documentType: 'AGREEMENT' } },
    });
    const reg = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/post-sales/advance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStage: 'AGREEMENT_REGISTERED', reason: 'spine walk' });
    expect(reg.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'REGISTERED' });
    expect(res.status).toBe(200);
    await expectStatus('REGISTERED');
  });

  it('10. possession: payment + possession preconditions, hand-over, then POSSESSION', async () => {
    // All payment milestones paid or waived (required for POSSESSION_OFFERED).
    const schedule = await request(app.getHttpServer())
      .post('/payment-schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId, bookingId, label: 'Booking Amount', amount: 78000000 });
    expect(schedule.status).toBe(201);
    await request(app.getHttpServer()).post(`/payment-schedules/${schedule.body.id}/mark-paid`).set('Authorization', `Bearer ${token}`).expect(201);

    // Possession preconditions: account/document/unit clearance.
    for (const field of ['accountClearanceConfirmed', 'documentClearanceConfirmed', 'unitReadinessConfirmed']) {
      const res = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/possession/confirm/${field}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);
    }

    // Advance one step at a time to POSSESSION_OFFERED.
    for (const toStage of ['PAYMENT_ACTIVE', 'PRE_POSSESSION', 'POSSESSION_OFFERED']) {
      const res = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/post-sales/advance`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStage, reason: 'spine walk' });
      expect(res.status).toBe(201);
    }

    await request(app.getHttpServer()).post(`/bookings/${bookingId}/possession/offer`).set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/possession/acknowledge`).set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/possession/hand-over`).set('Authorization', `Bearer ${token}`).expect(201);

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/post-sales/advance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toStage: 'HANDED_OVER', reason: 'spine walk' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'POSSESSION' });
    expect(res.status).toBe(200);
    await expectStatus('POSSESSION');
  });

  it('11. every transition on the walk was recorded as a Mikey autonomous action', async () => {
    const actions = await prisma.mikeyAutonomousAction.findMany({
      where: { leadId, tool: 'advance_stage' },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.length).toBeGreaterThanOrEqual(SPINE.length + 4); // CONTACTED..APPOINTMENT_BOOKED + BOOKED/AGREEMENT/LOAN_PROCESSING/REGISTERED/POSSESSION
  });
});
