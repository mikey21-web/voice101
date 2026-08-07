// Part 2 of the real-estate demo seed: covers everything part 1 didn't —
// Tasks, Deals/Conversions, Smart Lists, Campaigns, Forms, QR Codes,
// Message Log, Templates, Media, Call Logs, Webhooks/Integrations,
// Cash Flow Forecast, Bookings, and explicit Approval Requests.
// Requires seed-realestate-demo.js to have run first (reuses its leads/projects/properties/team).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = 'default-tenant';

function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  const leads = await prisma.lead.findMany({ where: { tenantId: TENANT_ID }, include: { contact: true } });
  const projects = await prisma.project.findMany({ where: { tenantId: TENANT_ID } });
  const properties = await prisma.property.findMany({ where: { tenantId: TENANT_ID } });
  const team = await prisma.user.findMany({ where: { tenantId: TENANT_ID } });
  const agents = team.filter(u => u.role === 'SALES_AGENT');
  const owner = team.find(u => u.role === 'OWNER') || team[0];
  if (!leads.length || !projects.length) { console.error('Run seed-realestate-demo.js first — no leads/projects found.'); process.exit(1); }

  // ============ TASKS ============
  console.log('Seeding tasks...');
  const taskTitles = [
    'Follow up on site visit feedback', 'Send updated cost sheet', 'Collect KYC documents', 'Schedule loan pre-approval call',
    'Confirm registration appointment', 'Share brochure and floor plan', 'Negotiate final price', 'Chase pending token amount',
    'Arrange virtual property tour', 'Verify RERA documents with buyer', 'Send possession letter', 'Update CRM with call outcome',
  ];
  for (let i = 0; i < taskTitles.length; i++) {
    await prisma.task.create({
      data: {
        title: taskTitles[i], status: pick(['pending', 'pending', 'in_progress', 'completed']),
        priority: pick(['low', 'medium', 'high']), dueAt: daysFromNow(rnd(-5, 20)),
        leadId: pick(leads).id, assigneeId: pick(agents.length ? agents : team).id, source: 'manual',
      },
    });
  }

  // ============ DEALS (Conversions) ============
  console.log('Seeding deals/conversions...');
  const destinations = ['APPOINTMENT_BOOKING', 'QUOTE_REQUEST', 'PURCHASE_ONLINE', 'CRM_QUALIFIED_PUSH'];
  const convStatuses = ['REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED', 'FAILED'];
  for (let i = 0; i < 12; i++) {
    const status = pick(convStatuses);
    await prisma.conversion.create({
      data: {
        destination: pick(destinations), status, leadId: pick(leads).id,
        scheduledAt: daysFromNow(rnd(-10, 15)), completedAt: status === 'COMPLETED' ? daysAgo(rnd(1, 20)) : undefined,
      },
    });
  }

  // ============ SMART LISTS ============
  console.log('Seeding smart lists...');
  const smartLists = [
    { name: 'Hot Buyers This Week', entity: 'lead', filters: { segment: 'HOT' } },
    { name: 'Ready to Move Interest', entity: 'lead', filters: { interest: 'Ready to move' } },
    { name: 'High Budget (3Cr+)', entity: 'lead', filters: { budget: '3Cr+' } },
    { name: 'Site Visit Pending', entity: 'lead', filters: { status: 'APPOINTMENT_BOOKED' } },
    { name: 'Cold Leads to Re-engage', entity: 'lead', filters: { segment: 'COLD' } },
  ];
  for (const sl of smartLists) {
    await prisma.savedFilter.create({ data: { name: sl.name, entity: sl.entity, filters: sl.filters, userId: owner.id, isShared: true } });
  }

  // ============ FORMS ============
  console.log('Seeding forms...');
  const form1 = await prisma.leadForm.create({
    data: {
      name: 'Property Inquiry Form', formType: 'inquiry',
      steps: [{ id: 'step1', title: 'Your Details' }],
      fields: { create: [
        { label: 'Full Name', fieldKey: 'name', type: 'text', required: true, displayOrder: 0 },
        { label: 'Phone Number', fieldKey: 'phone', type: 'tel', required: true, displayOrder: 1 },
        { label: 'Property Type', fieldKey: 'property_type', type: 'select', options: ['Apartment', 'Villa', 'Plot', 'Commercial'], displayOrder: 2 },
        { label: 'Budget Range', fieldKey: 'budget', type: 'select', options: ['50L-80L', '80L-1.5Cr', '1.5Cr-3Cr', '3Cr+'], displayOrder: 3 },
      ] },
    },
  });
  const form2 = await prisma.leadForm.create({
    data: {
      name: 'Site Visit Booking Form', formType: 'booking',
      steps: [{ id: 'step1', title: 'Schedule Your Visit' }],
      fields: { create: [
        { label: 'Full Name', fieldKey: 'name', type: 'text', required: true, displayOrder: 0 },
        { label: 'Preferred Date', fieldKey: 'visit_date', type: 'date', required: true, displayOrder: 1 },
        { label: 'Project of Interest', fieldKey: 'project', type: 'text', displayOrder: 2 },
      ] },
    },
  });
  for (let i = 0; i < 12; i++) {
    const form = pick([form1, form2]);
    await prisma.formSubmission.create({
      data: { formId: form.id, payload: { name: pick(leads).contact?.name || 'Buyer', phone: '+919876543210' }, leadId: pick(leads).id, source: pick(['direct', 'campaign']), completed: true, completedAt: daysAgo(rnd(1, 40)) },
    });
  }

  // ============ QR CODES ============
  console.log('Seeding QR codes...');
  const qrData = [
    { name: 'Skyline Meridian — Site Board QR', destinationType: 'project', destination: projects[0]?.id },
    { name: 'Palm Orchid — Newspaper Ad QR', destinationType: 'project', destination: projects[1]?.id },
    { name: 'Emerald Heights — Hoarding QR', destinationType: 'project', destination: projects[2]?.id },
    { name: 'Property Brochure QR', destinationType: 'form', destination: form1.id },
    { name: 'Site Visit Booking QR', destinationType: 'form', destination: form2.id },
    { name: 'WhatsApp Enquiry QR', destinationType: 'whatsapp', destination: '+919876500000' },
  ];
  const qrCodes = [];
  for (const q of qrData) {
    const qr = await prisma.qrCode.create({ data: { name: q.name, destinationType: q.destinationType, destination: q.destination || 'n/a' } });
    qrCodes.push(qr);
    for (let s = 0; s < rnd(3, 15); s++) {
      await prisma.qrScan.create({ data: { qrCodeId: qr.id, country: 'India', city: pick(['Bangalore', 'Hyderabad', 'Mumbai']), createdAt: daysAgo(rnd(1, 60)) } });
    }
  }

  // ============ CAMPAIGNS ============
  console.log('Seeding campaigns...');
  const campaignData = [
    { name: 'Skyline Meridian Launch — Meta Ads', sourceType: 'META_ADS', status: 'active' },
    { name: 'Google Search — Ready to Move Homes', sourceType: 'GOOGLE_ADS', status: 'active' },
    { name: 'MagicBricks Featured Listing', sourceType: 'MAGICBRICKS', status: 'active' },
    { name: '99acres Premium Package', sourceType: 'NINETY_NINE_ACRES', status: 'paused' },
    { name: 'Housing.com Sponsored', sourceType: 'HOUSING_COM', status: 'completed' },
    { name: 'WhatsApp Broadcast — Diwali Offer', sourceType: 'WHATSAPP', status: 'draft' },
    { name: 'Referral Program Q3', sourceType: 'REFERRAL', status: 'active' },
    { name: 'JustDial Listing Boost', sourceType: 'JUSTDIAL', status: 'archived' },
  ];
  const campaigns = [];
  for (const c of campaignData) {
    const spend = rnd(10000, 250000);
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: TENANT_ID, name: c.name, sourceType: c.sourceType, status: c.status, active: c.status === 'active',
        creatorId: owner.id, assignedAgentId: pick(agents).id, formId: form1.id, qrCodeId: pick(qrCodes).id,
        startDate: daysAgo(rnd(10, 90)), budget: { total: spend * 2, daily: Math.round(spend / 30), spent: spend, currency: 'INR' },
        totalBudget: spend * 2, totalSpend: spend, totalLeads: rnd(5, 60), totalConversions: rnd(1, 15),
        costPerLead: Math.round(spend / rnd(5, 60)), roi: Math.round(rnd(80, 320)),
      },
    });
    campaigns.push(campaign);
  }

  // ============ MESSAGE TEMPLATES ============
  console.log('Seeding message templates...');
  const templateData = [
    { name: 'Welcome Message', type: 'WELCOME', channel: 'WHATSAPP', body: 'Hi {{name}}, thanks for reaching out to Acme Realty. I\'d love to help you find the perfect property.' },
    { name: 'Site Visit Invite', type: 'FOLLOW_UP', channel: 'WHATSAPP', body: 'Hi {{name}}, based on your preferences, I have a few properties that might interest you. Would you like to schedule a site visit this weekend?' },
    { name: 'Appointment Confirmation', type: 'APPOINTMENT_LINK', channel: 'WHATSAPP', body: 'Your site visit for {{project}} is confirmed for {{date}} at {{time}}. See you there!' },
    { name: 'Quote Follow-up', type: 'QUOTE_REQUEST', channel: 'EMAIL', body: 'Hi {{name}}, please find attached the quotation for {{property}}. Let us know if you have questions.' },
    { name: 'Payment Reminder', type: 'PAYMENT_LINK', channel: 'SMS', body: 'Reminder: your payment of {{amount}} for {{milestone}} is due on {{dueDate}}.' },
    { name: 'Thank You — Booking Confirmed', type: 'THANK_YOU', channel: 'WHATSAPP', body: 'Congratulations {{name}}! Your booking for {{property}} is confirmed. Our team will reach out with next steps.' },
  ];
  const templates = [];
  for (const t of templateData) {
    const tpl = await prisma.messageTemplate.create({ data: { ...t, creatorId: owner.id, variables: ['name', 'project', 'property', 'date', 'time', 'amount'] } });
    templates.push(tpl);
  }

  // ============ MESSAGE LOG (ConversationMessage) ============
  console.log('Seeding message log...');
  for (let i = 0; i < 20; i++) {
    const lead = pick(leads);
    const inbound = await prisma.conversationMessage.create({
      data: { text: pick(['Is this property still available?', 'Can I schedule a visit this weekend?', 'What is the total cost including registration?', 'Do you have any 3BHK options in this budget?', 'Please share the brochure']), channel: 'WHATSAPP', direction: 'INBOUND', leadId: lead.id, contactId: lead.contactId, createdAt: daysAgo(rnd(1, 30)) },
    });
    await prisma.conversationMessage.create({
      data: { text: pick(['Yes, it\'s available! Would you like to schedule a visit?', 'Absolutely, I have slots available this Saturday and Sunday.', 'Sure, let me send you the full cost breakdown.', 'Yes, we have a few great 3BHK options — sharing details shortly.']), channel: 'WHATSAPP', direction: 'OUTBOUND', leadId: lead.id, contactId: lead.contactId, messageTemplateId: pick(templates).id, createdAt: new Date(inbound.createdAt.getTime() + rnd(2, 40) * 60000) },
    });
  }

  // ============ MEDIA LIBRARY ============
  console.log('Seeding media library...');
  const mediaSamples = [
    { name: 'Skyline Meridian Brochure.pdf', ext: 'pdf', mime: 'application/pdf', category: 'BROCHURE', url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600' },
    { name: 'Property Walkthrough Video.mp4', ext: 'mp4', mime: 'video/mp4', category: 'CATALOG', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600' },
    { name: 'Floor Plan - 3BHK.jpg', ext: 'jpg', mime: 'image/jpeg', category: 'OTHER', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600' },
    { name: 'Amenities Showcase.jpg', ext: 'jpg', mime: 'image/jpeg', category: 'CASE_STUDY', url: 'https://images.unsplash.com/photo-1591825729269-caeb344f6df2?w=1600' },
    { name: 'RERA Certificate.pdf', ext: 'pdf', mime: 'application/pdf', category: 'OTHER', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600' },
  ];
  for (let i = 0; i < mediaSamples.length; i++) {
    const m = mediaSamples[i];
    await prisma.mediaFile.create({
      data: {
        fileName: m.name, originalName: m.name, fileType: m.ext, mimeType: m.mime,
        fileSize: rnd(200000, 8000000), storageKey: `demo-${i}.${m.ext}`, publicUrl: m.url,
        category: m.category, uploadedById: owner.id, projectId: pick(projects).id,
      },
    });
  }

  // ============ CALL LOGS ============
  console.log('Seeding call logs...');
  const callStatuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'NO_ANSWER', 'MISSED', 'BUSY'];
  const dispositions = ['connected_qualified', 'connected_follow_up', 'site_visit_scheduled', 'not_interested', 'no_answer'];
  for (let i = 0; i < 15; i++) {
    const lead = pick(leads);
    const status = pick(callStatuses);
    await prisma.callLog.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, contactId: lead.contactId, agentId: pick(agents).id,
        direction: pick(['INBOUND', 'OUTBOUND']), status, fromNumber: '+919876500000', toNumber: '+919876543210',
        durationSec: status === 'COMPLETED' ? rnd(30, 900) : 0, source: 'TWILIO', disposition: pick(dispositions),
        summary: status === 'COMPLETED' ? 'Buyer interested, discussed budget and timeline, follow-up scheduled.' : undefined,
        createdAt: daysAgo(rnd(1, 45)),
      },
    });
  }

  // ============ WEBHOOKS + INTEGRATIONS ============
  console.log('Seeding webhooks and integrations...');
  const webhooks = [
    { name: 'Slack — New Lead Alerts', url: 'https://hooks.slack.com/services/DEMO/WEBHOOK/xxxxx', events: ['lead.created'] },
    { name: 'Zapier — CRM Sync', url: 'https://hooks.zapier.com/hooks/catch/demo/xxxxx', events: ['lead.updated', 'conversion.completed'] },
  ];
  for (const w of webhooks) {
    await prisma.outboundWebhook.create({ data: { ...w, tenantId: TENANT_ID, secret: 'demo-secret-key', active: true } });
  }
  const integrations = [
    { type: 'sms', name: 'Twilio SMS', config: { provider: 'twilio' }, isActive: true, status: 'connected' },
    { type: 'whatsapp', name: 'WhatsApp Business API', config: { provider: 'meta' }, isActive: true, status: 'connected' },
    { type: 'chat_widget', name: 'Website Chat Widget', config: { theme: 'blue', position: 'bottom-right' }, isActive: true, status: 'connected' },
    { type: 'email', name: 'SendGrid Email', config: { provider: 'sendgrid' }, isActive: true, status: 'connected' },
    { type: 'social', name: 'Facebook Lead Ads', config: { provider: 'meta' }, isActive: false, status: 'disconnected' },
  ];
  for (const i of integrations) {
    await prisma.integration.create({ data: { ...i, tenantId: TENANT_ID } });
  }

  // ============ CASH FLOW FORECAST ============
  console.log('Seeding cash flow forecast entries...');
  const entryTypes = ['EXPECTED_COLLECTION', 'EXPECTED_COLLECTION', 'EXPECTED_COLLECTION', 'EXPECTED_COMMISSION_PAYOUT', 'PLANNED_EXPENSE', 'EXPECTED_REFUND'];
  for (const project of projects) {
    for (let i = 0; i < rnd(3, 5); i++) {
      const type = pick(entryTypes);
      await prisma.cashFlowForecastEntry.create({
        data: {
          tenantId: TENANT_ID, projectId: project.id, entryType: type, amountPaise: BigInt(rnd(200000, 15000000) * 100),
          expectedDate: daysFromNow(rnd(-10, 90)), sourceType: type === 'EXPECTED_COLLECTION' ? 'PaymentSchedule' : type === 'EXPECTED_COMMISSION_PAYOUT' ? 'CommissionAccrual' : 'manual',
          notes: type === 'EXPECTED_COLLECTION' ? 'Expected milestone collection' : type === 'PLANNED_EXPENSE' ? 'Construction & marketing spend' : undefined,
          createdById: owner.id,
        },
      });
    }
  }

  // ============ BOOKINGS ============
  console.log('Seeding bookings...');
  const bookingStatuses = ['PENDING', 'CONFIRMED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  for (let i = 0; i < 10; i++) {
    const lead = pick(leads);
    const property = pick(properties);
    const status = pick(bookingStatuses);
    await prisma.booking.create({
      data: {
        tenantId: TENANT_ID, leadId: lead.id, propertyId: property.id, title: `Booking — ${property.title}`,
        startTime: daysFromNow(rnd(-20, 30)), status, price: property.price, currency: 'INR',
        bookingNumber: `BK-${Date.now().toString(36).toUpperCase()}-${i}`,
        bookingAmountPaise: status === 'CONFIRMED' || status === 'COMPLETED' ? BigInt(Math.round((property.price || 5000000) * 0.1 * 100)) : undefined,
        confirmedAt: status === 'CONFIRMED' || status === 'COMPLETED' ? daysAgo(rnd(1, 40)) : undefined,
        confirmedById: status === 'CONFIRMED' || status === 'COMPLETED' ? pick(agents).id : undefined,
      },
    });
  }

  // ============ EXPLICIT APPROVAL REQUESTS ============
  console.log('Seeding approval requests...');
  const approvalTypes = ['discount', 'hold_extension', 'price_override', 'payment_waiver'];
  for (let i = 0; i < 6; i++) {
    const status = pick(['PENDING', 'PENDING', 'APPROVED', 'REJECTED']);
    await prisma.approvalRequest.create({
      data: {
        tenantId: TENANT_ID, type: pick(approvalTypes), entityType: 'Lead', entityId: pick(leads).id,
        requestedById: pick(agents).id, status, amountPaise: BigInt(rnd(50000, 500000) * 100),
        reason: 'Buyer requested special consideration during negotiation',
        approvedById: status !== 'PENDING' ? owner.id : undefined, decidedAt: status !== 'PENDING' ? daysAgo(rnd(1, 15)) : undefined,
      },
    });
  }

  console.log('\nDone. Part 2 summary:');
  const counts = await Promise.all([
    prisma.task.count(), prisma.conversion.count(), prisma.savedFilter.count(), prisma.leadForm.count(),
    prisma.formSubmission.count(), prisma.qrCode.count(), prisma.campaign.count({ where: { tenantId: TENANT_ID } }),
    prisma.messageTemplate.count(), prisma.conversationMessage.count(), prisma.mediaFile.count(),
    prisma.callLog.count({ where: { tenantId: TENANT_ID } }), prisma.outboundWebhook.count({ where: { tenantId: TENANT_ID } }),
    prisma.integration.count({ where: { tenantId: TENANT_ID } }), prisma.cashFlowForecastEntry.count({ where: { tenantId: TENANT_ID } }),
    prisma.booking.count({ where: { tenantId: TENANT_ID } }), prisma.approvalRequest.count({ where: { tenantId: TENANT_ID } }),
  ]);
  const labels = ['tasks', 'conversions', 'savedFilters', 'leadForms', 'formSubmissions', 'qrCodes', 'campaigns', 'messageTemplates', 'conversationMessages', 'mediaFiles', 'callLogs', 'outboundWebhooks', 'integrations', 'cashFlowForecastEntries', 'bookings', 'approvalRequests'];
  labels.forEach((l, i) => console.log(`  ${l}: ${counts[i]}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
