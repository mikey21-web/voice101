import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

// Date.now() alone is millisecond precision, so two jest workers starting in
// the same millisecond generated identical slugs and emails and one of them
// died on the unique constraint. That was the whole flake.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const TENANT_A = { name: 'Tenant A', slug: `tenant-a-${RUN}` };
const TENANT_B = { name: 'Tenant B', slug: `tenant-b-${RUN}` };
const USER_A = { email: `ta-user-${RUN}@test.com`, password: 'Test123456' };
const USER_B = { email: `tb-user-${RUN}@test.com`, password: 'Test123456' };

let tokenA: string;
let tokenB: string;
let tenantAId: string;
let tenantBId: string;
let aContactId: string;
let aLeadId: string;
let aCampaignId: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  prisma = app.get(PrismaService);

  // --- Create two tenants ---
  const tA = await prisma.tenant.create({ data: TENANT_A });
  tenantAId = tA.id;
  const tB = await prisma.tenant.create({ data: TENANT_B });
  tenantBId = tB.id;

  // --- Create OWNER user in each tenant ---
  const hash = await bcrypt.hash(USER_A.password, 1);
  await prisma.user.create({
    data: { email: USER_A.email, name: 'User A', password: hash, role: 'OWNER', active: true, tenantId: tenantAId },
  });

  const hashB = await bcrypt.hash(USER_B.password, 1);
  await prisma.user.create({
    data: { email: USER_B.email, name: 'User B', password: hashB, role: 'OWNER', active: true, tenantId: tenantBId },
  });

  // --- Login as both users ---
  const loginA = await request(app.getHttpServer()).post('/auth/login').send(USER_A);
  tokenA = loginA.body.accessToken;

  const loginB = await request(app.getHttpServer()).post('/auth/login').send(USER_B);
  tokenB = loginB.body.accessToken;

  // --- Tenant A creates a contact, lead, and campaign ---
  const contact = await request(app.getHttpServer())
    .post('/contacts').set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'Alice', email: 'alice@a.com', phone: '+1111111111' });
  aContactId = contact.body.id;

  const lead = await request(app.getHttpServer())
    .post('/leads').set('Authorization', `Bearer ${tokenA}`)
    .send({ contactId: aContactId, source: 'FORM', message: 'Lead from A' });
  aLeadId = lead.body.id;

  const campaign = await request(app.getHttpServer())
    .post('/campaigns').set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'Campaign A', sourceType: 'FORM' });
  aCampaignId = campaign.body.id;
}, 30000);

afterAll(async () => {
  // Clean up Tenant A data
  await prisma.campaignTimelineEntry.deleteMany({ where: { campaignId: aCampaignId } }).catch(() => {});
  await prisma.conversationMessage.deleteMany({ where: { campaignId: aCampaignId } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { id: aCampaignId } }).catch(() => {});
  await prisma.scoreLog.deleteMany({ where: { leadId: aLeadId } }).catch(() => {});
  await prisma.task.deleteMany({ where: { leadId: aLeadId } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: aLeadId } }).catch(() => {});
  await prisma.contact.deleteMany({ where: { id: aContactId } }).catch(() => {});

  // Clean up all users and tenants
  for (const email of [USER_A.email, USER_B.email]) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
  }
  await prisma.tenant.deleteMany({ where: { id: tenantAId } }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: tenantBId } }).catch(() => {});

  await app.close();
}, 15000);

describe('Tenant Isolation', () => {
  it('Tenant B cannot see Tenant A contact by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/contacts/${aContactId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('Tenant B cannot see Tenant A contact in list', async () => {
    const res = await request(app.getHttpServer())
      .get('/contacts').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const ids = (res.body.data ?? res.body).map((c: any) => c.id);
    expect(ids).not.toContain(aContactId);
  });

  it('Tenant B cannot see Tenant A lead by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/leads/${aLeadId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('Tenant B cannot see Tenant A lead in list', async () => {
    const res = await request(app.getHttpServer())
      .get('/leads').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    const ids = data.map((l: any) => l.id);
    expect(ids).not.toContain(aLeadId);
  });

  it('Tenant B cannot see Tenant A campaign by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/campaigns/${aCampaignId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('Tenant B cannot see Tenant A campaign in list', async () => {
    const res = await request(app.getHttpServer())
      .get('/campaigns').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    const ids = data.map((c: any) => c.id);
    expect(ids).not.toContain(aCampaignId);
  });

  it('Tenant B can create their own contact', async () => {
    const res = await request(app.getHttpServer())
      .post('/contacts').set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Bob', email: 'bob@b.com', phone: '+2222222222' });
    expect(res.status).toBe(201);
    // cleanup
    await prisma.contact.delete({ where: { id: res.body.id } }).catch(() => {});
  });

  it('Tenant B can create their own lead', async () => {
    const contact = await request(app.getHttpServer())
      .post('/contacts').set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'LeadBob', email: 'leadbob@b.com' });
    expect(contact.status).toBe(201);
    const res = await request(app.getHttpServer())
      .post('/leads').set('Authorization', `Bearer ${tokenB}`)
      .send({ contactId: contact.body.id, source: 'FORM', message: 'Lead from B' });
    expect(res.status).toBe(201);
    await prisma.lead.delete({ where: { id: res.body.id } }).catch(() => {});
    await prisma.contact.delete({ where: { id: contact.body.id } }).catch(() => {});
  });

  it('Tenant B can create their own campaign', async () => {
    const res = await request(app.getHttpServer())
      .post('/campaigns').set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Campaign B', sourceType: 'FORM' });
    expect(res.status).toBe(201);
    await prisma.campaignTimelineEntry.deleteMany({ where: { campaignId: res.body.id } }).catch(() => {});
    await prisma.campaign.delete({ where: { id: res.body.id } }).catch(() => {});
  });
});
