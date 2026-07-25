import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TENANT_ID = 'default-tenant';

async function main() {
  const existingLeads = await prisma.lead.count();
  if (existingLeads > 5) {
    console.log(`Seed mock skipped - ${existingLeads} leads already exist`);
    return;
  }

  // 1. Pipeline Stages (one per LeadStatus, status is the unique key)
  console.log('Seeding pipeline stages...');
  const stages = [
    { status: 'NEW', name: 'New Lead', order: 0, color: '#6366f1', isDefault: true },
    { status: 'CONTACTED', name: 'Contacted', order: 1, color: '#8b5cf6' },
    { status: 'QUALIFIED', name: 'Qualified', order: 2, color: '#3b82f6' },
    { status: 'PROPOSAL_SENT', name: 'Negotiation', order: 3, color: '#f59e0b' },
    { status: 'CONVERTED', name: 'Closed Won', order: 4, color: '#10b981', isEnd: true },
    { status: 'LOST', name: 'Closed Lost', order: 5, color: '#ef4444', isEnd: true },
  ] as const;
  for (const s of stages) {
    await prisma.pipelineStage.upsert({
      where: { status: s.status as any },
      update: s,
      create: s as any,
    });
  }

  // 2. Users
  console.log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 12);
  const users = [
    { id: 'user-sarah', name: 'Sarah Chen', email: 'sarah@example.com', role: 'SALES_AGENT' as const },
    { id: 'user-marcus', name: 'Marcus Johnson', email: 'marcus@example.com', role: 'MANAGER' as const },
    { id: 'user-priya', name: 'Priya Sharma', email: 'priya@example.com', role: 'SALES_AGENT' as const },
    { id: 'user-alex', name: 'Alex Rivera', email: 'alex@example.com', role: 'ADMIN' as const },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { ...u, password: hashedPassword, active: true, tenantId: TENANT_ID },
    });
  }

  // 3. Contacts
  console.log('Seeding contacts...');
  const contactsData = [
    { name: 'John Smith', email: 'john.smith@gmail.com', phone: '+919876543210', company: 'TechStart Inc', location: 'Bangalore', tags: ['tech', 'startup'] },
    { name: 'Emily Davis', email: 'emily.davis@yahoo.com', phone: '+919876543211', company: 'GreenLeaf Corp', location: 'Mumbai', tags: ['eco', 'enterprise'] },
    { name: 'Raj Patel', email: 'raj.patel@outlook.com', phone: '+919876543212', company: 'Patel & Sons', location: 'Ahmedabad', tags: ['family', 'local'] },
    { name: 'Lisa Wong', email: 'lisa.wong@gmail.com', phone: '+919876543213', company: 'Digital Nomad Co', location: 'Goa', tags: ['digital', 'freelancer'] },
    { name: 'Ahmed Hassan', email: 'ahmed.hassan@company.com', phone: '+919876543214', company: 'Hassan Group', location: 'Hyderabad', tags: ['enterprise', 'b2b'] },
    { name: 'Maria Garcia', email: 'maria.garcia@email.com', phone: '+919876543215', company: 'Creative Studio', location: 'Delhi', tags: ['creative', 'agency'] },
    { name: 'David Kim', email: 'david.kim@work.com', phone: '+919876543216', company: 'KimTech Solutions', location: 'Pune', tags: ['tech', 'saas'] },
    { name: 'Ananya Reddy', email: 'ananya.reddy@gmail.com', phone: '+919876543217', company: 'Reddy Enterprises', location: 'Chennai', tags: ['enterprise', 'b2c'] },
    { name: 'Tom Wilson', email: 'tom.wilson@outlook.com', phone: '+919876543218', company: 'Wilson Consulting', location: 'Kolkata', tags: ['consulting', 'solo'] },
    { name: 'Fatima Al-Sayed', email: 'fatima.alsayed@email.com', phone: '+919876543219', company: 'Al-Sayed Holdings', location: 'Dubai', tags: ['enterprise', 'investor'] },
    { name: 'James Brown', email: 'james.brown@test.com', phone: '+919876543220', company: 'Brown & Co', location: 'Mumbai', tags: ['test', 'local'] },
    { name: 'Neha Gupta', email: 'neha.gupta@gmail.com', phone: '+919876543221', company: 'Gupta Retail', location: 'Jaipur', tags: ['retail', 'b2c'] },
  ];
  const contacts: any[] = [];
  for (const c of contactsData) {
    const existing = await prisma.contact.findFirst({ where: { phone: c.phone } });
    const contact = existing
      ? await prisma.contact.update({ where: { id: existing.id }, data: c })
      : await prisma.contact.create({ data: { ...c, consentStatus: 'opted_in', tenantId: TENANT_ID } });
    contacts.push(contact);
  }

  // 4. Campaigns
  console.log('Seeding campaigns...');
  const campaignsData = [
    { name: 'Summer Launch 2026', sourceType: 'CAMPAIGN' as const, offer: '20% off first consultation', active: true },
    { name: 'Website Lead Gen', sourceType: 'FORM' as const, offer: 'Free business audit report', active: true },
    { name: 'Conference Outreach', sourceType: 'CAMPAIGN' as const, offer: 'Exclusive demo session', active: false },
    { name: 'Referral Program', sourceType: 'SOCIAL_MEDIA' as const, offer: 'Refer a friend - get 5000 INR credit', active: true },
  ];
  const campaigns: any[] = [];
  for (const c of campaignsData) {
    const campaign = await prisma.campaign.create({
      data: { ...c, tenantId: TENANT_ID, creatorId: users[3].id },
    });
    campaigns.push(campaign);
  }

  // 5. Leads
  console.log('Seeding leads...');
  const leadStatuses = ['NEW', 'CONTACTED', 'ENGAGED', 'QUALIFYING', 'QUALIFIED', 'CONVERTED', 'LOST'] as const;
  const leadSegments = ['HOT', 'WARM', 'COLD', 'UNQUALIFIED'] as const;
  const leadSources = ['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'FORM', 'CAMPAIGN', 'WHATSAPP'] as const;

  const leadDetails = [
    { contactIdx: 0, status: 'QUALIFIED', segment: 'HOT', score: 85, priority: 'HIGH', source: 'REFERRAL', budget: '50000-100000', urgency: 'urgent - need within a month', interest: 'Business consulting', campaignIdx: 0 },
    { contactIdx: 1, status: 'ENGAGED', segment: 'WARM', score: 55, priority: 'MEDIUM', source: 'FORM', budget: '10000-25000', interest: 'Digital marketing', campaignIdx: 1 },
    { contactIdx: 2, status: 'CONTACTED', segment: 'WARM', score: 45, priority: 'MEDIUM', source: 'CAMPAIGN', budget: null, interest: 'Automation tools', campaignIdx: 0 },
    { contactIdx: 3, status: 'CONVERTED', segment: 'HOT', score: 92, priority: 'HIGH', source: 'SOCIAL_MEDIA', budget: '25000-50000', interest: 'Full suite', campaignIdx: 3 },
    { contactIdx: 4, status: 'QUALIFYING', segment: 'WARM', score: 60, priority: 'MEDIUM', source: 'FORM', budget: '100000+', interest: 'Enterprise solution', campaignIdx: 2 },
    { contactIdx: 5, status: 'LOST', segment: 'COLD', score: 10, priority: 'LOW', source: 'FORM', budget: null, interest: null, campaignIdx: null },
    { contactIdx: 6, status: 'QUALIFIED', segment: 'HOT', score: 78, priority: 'HIGH', source: 'REFERRAL', budget: '50000-75000', interest: 'SaaS integration', campaignIdx: 1 },
    { contactIdx: 7, status: 'NEW', segment: 'COLD', score: 20, priority: 'LOW', source: 'FORM', budget: null, interest: null, campaignIdx: null },
    { contactIdx: 8, status: 'ENGAGED', segment: 'WARM', score: 48, priority: 'MEDIUM', source: 'SOCIAL_MEDIA', budget: '10000', interest: 'Consulting', campaignIdx: 3 },
    { contactIdx: 9, status: 'CONTACTED', segment: 'HOT', score: 70, priority: 'HIGH', source: 'REFERRAL', budget: '200000+', interest: 'Full enterprise', campaignIdx: 0 },
    { contactIdx: 10, status: 'NEW', segment: 'COLD', score: 5, priority: 'LOW', source: 'FORM', budget: null, interest: null, campaignIdx: null },
    { contactIdx: 11, status: 'QUALIFYING', segment: 'WARM', score: 40, priority: 'MEDIUM', source: 'FORM', budget: '15000-30000', interest: 'Retail automation', campaignIdx: 1 },
  ];

  const agentIds = ['user-sarah', 'user-marcus', 'user-priya'];
  const priorityToInt: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const leads: any[] = [];
  for (const ld of leadDetails) {
    const lead = await prisma.lead.create({
      data: {
        contactId: contacts[ld.contactIdx].id,
        tenantId: TENANT_ID,
        status: ld.status as any,
        segment: ld.segment as any,
        score: ld.score,
        priority: priorityToInt[ld.priority] ?? 1,
        source: ld.source as any,
        budget: ld.budget,
        urgency: ld.urgency,
        interest: ld.interest,
        message: `Interested in ${ld.interest || 'learning more about services'}`,
        campaignId: ld.campaignIdx !== null ? campaigns[ld.campaignIdx].id : null,
        assignedAgentId: ld.score >= 70 ? agentIds[Math.floor(Math.random() * 3)] : null,
        metadata: { source_url: `https://example.com/landing/${ld.source.toLowerCase()}` },
      },
    });
    leads.push(lead);
  }

  // 6. Conversations
  console.log('Seeding conversations...');
  const conversationTexts = [
    { leadIdx: 0, inbound: 'Hi, I was referred by a friend. Can you tell me about your business consulting services?', outbound: 'Hi John! Thanks for reaching out. We offer comprehensive business consulting including strategy, operations, and growth planning. What aspect are you most interested in?' },
    { leadIdx: 0, inbound: 'I need help with operational efficiency and scaling.', outbound: 'Great, operational optimization is one of our specialties! Would you be available for a free 30-min discovery call this week?' },
    { leadIdx: 1, inbound: 'Saw your website, interested in digital marketing.', outbound: 'Hi Emily! Happy to help with digital marketing. We cover SEO, paid ads, content marketing, and social media. What channels are you focusing on?' },
    { leadIdx: 2, inbound: 'Got your campaign email. What automation tools do you offer?', outbound: 'Hi Raj! We offer workflow automation, chatbot setup, CRM integration, and lead nurturing systems. Would you like to see a demo?' },
    { leadIdx: 3, inbound: 'Your Instagram caught my eye! What all do you offer?', outbound: 'Hey Lisa! So glad you reached out. We help businesses streamline operations, automate follow-ups, and boost conversions. What type of business do you run?' },
    { leadIdx: 4, inbound: 'Submitted a form on your site. Looking for enterprise solutions.', outbound: 'Hello Ahmed! Thank you for your interest. Our enterprise tier includes dedicated support, custom integrations, SLA guarantees, and multi-user access. Would you like a personalized walkthrough?' },
  ];

  for (const conv of conversationTexts) {
    const leadId = leads[conv.leadIdx].id;
    const contactId = contacts[leadDetails[conv.leadIdx].contactIdx].id;
    const inbound = await prisma.conversationMessage.create({
      data: { leadId, contactId, text: conv.inbound, channel: 'TELEGRAM', direction: 'INBOUND' },
    });
    const outboundMin = new Date(inbound.createdAt.getTime() + 60000);
    await prisma.conversationMessage.create({
      data: { leadId, contactId, text: conv.outbound, channel: 'TELEGRAM', direction: 'OUTBOUND', deliveryStatus: 'delivered', createdAt: outboundMin },
    });
  }

  // 7. Message Templates
  console.log('Seeding message templates...');
  const templates = [
    { name: 'Welcome Message', type: 'WELCOME' as const, channel: 'WHATSAPP' as const, body: 'Hi {{name}}! Welcome to {{businessName}}. How can we help you today?', variables: [{ key: 'name', label: 'Contact Name' }, { key: 'businessName', label: 'Business Name' }] },
    { name: 'Follow Up', type: 'FOLLOW_UP' as const, channel: 'WHATSAPP' as const, body: 'Hi {{name}}, just checking in! Have you had a chance to think about our conversation?', variables: [{ key: 'name', label: 'Contact Name' }] },
    { name: 'Appointment Reminder', type: 'APPOINTMENT_LINK' as const, channel: 'WHATSAPP' as const, body: 'Hi {{name}}! Your appointment is confirmed for {{date}} at {{time}}. Click here to join: {{link}}', variables: [{ key: 'name', label: 'Name' }, { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'link', label: 'Meeting Link' }] },
    { name: 'Thank You', type: 'THANK_YOU' as const, channel: 'EMAIL' as const, body: 'Dear {{name}},\n\nThank you for your time today. We look forward to working with you!\n\nBest,\n{{businessName}} Team', variables: [{ key: 'name', label: 'Name' }, { key: 'businessName', label: 'Business Name' }] },
    { name: 'Re-engagement', type: 'RECONNECT' as const, channel: 'WHATSAPP' as const, body: 'Hi {{name}}! It has been a while. We have some exciting new updates to share. Want to catch up?', variables: [{ key: 'name', label: 'Name' }] },
    { name: 'Qualification Question', type: 'QUALIFICATION_QUESTION' as const, channel: 'WHATSAPP' as const, body: 'Hi {{name}}! To better understand your needs, could you tell me what your budget range looks like?', variables: [{ key: 'name', label: 'Name' }] },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.create({
      data: { ...t, variables: JSON.stringify(t.variables), creatorId: users[3].id },
    });
  }

  // 8. Nurture Sequences
  console.log('Seeding nurture sequences...');
  const seq1 = await prisma.nurtureSequence.create({
    data: { name: 'Cold Lead Nurture', active: true },
  });
  await prisma.nurtureStep.createMany({
    data: [
      { sequenceId: seq1.id, displayOrder: 0, type: 'WAIT', config: { hours: 24 } },
      { sequenceId: seq1.id, displayOrder: 1, type: 'SEND_WHATSAPP', config: { template: 'Follow Up' } },
      { sequenceId: seq1.id, displayOrder: 2, type: 'WAIT', config: { hours: 72 } },
      { sequenceId: seq1.id, displayOrder: 3, type: 'SEND_EMAIL', config: { template: 'Re-engagement' } },
      { sequenceId: seq1.id, displayOrder: 4, type: 'WAIT', config: { hours: 168 } },
      { sequenceId: seq1.id, displayOrder: 5, type: 'UPDATE_LEAD_STATUS', config: { status: 'COLD' } },
    ],
  });

  const seq2 = await prisma.nurtureSequence.create({
    data: { name: 'Hot Lead Follow-up', active: true },
  });
  await prisma.nurtureStep.createMany({
    data: [
      { sequenceId: seq2.id, displayOrder: 0, type: 'SEND_WHATSAPP', config: { template: 'Welcome Message' } },
      { sequenceId: seq2.id, displayOrder: 1, type: 'WAIT', config: { hours: 2 } },
      { sequenceId: seq2.id, displayOrder: 2, type: 'SEND_BOOKING_LINK', config: { message: 'Ready to book a call?' } },
      { sequenceId: seq2.id, displayOrder: 3, type: 'WAIT', config: { hours: 24 } },
      { sequenceId: seq2.id, displayOrder: 4, type: 'CREATE_TASK', config: { assignTo: 'assignedAgent', title: 'Follow up with hot lead' } },
    ],
  });

  // 9. Tasks
  console.log('Seeding tasks...');
  const tasks = [
    { title: 'Prepare proposal for TechStart Inc', leadIdx: 0, assigneeIdx: 0, priority: 'high' as const, status: 'pending' as const },
    { title: 'Send follow-up email to GreenLeaf Corp', leadIdx: 1, assigneeIdx: 1, priority: 'medium' as const, status: 'pending' as const },
    { title: 'Call Patel & Sons - discuss automation', leadIdx: 2, assigneeIdx: 2, priority: 'medium' as const, status: 'in_progress' as const },
    { title: 'Onboard Digital Nomad Co - welcome package', leadIdx: 3, assigneeIdx: 0, priority: 'high' as const, status: 'done' as const },
    { title: 'Schedule demo for KimTech Solutions', leadIdx: 6, assigneeIdx: 1, priority: 'high' as const, status: 'pending' as const },
    { title: 'Review enterprise requirements - Hassan Group', leadIdx: 4, assigneeIdx: 2, priority: 'medium' as const, status: 'pending' as const },
  ];
  for (const t of tasks) {
    await prisma.task.create({
      data: {
        title: t.title,
        priority: t.priority,
        status: t.status,
        leadId: leads[t.leadIdx].id,
        assigneeId: users[t.assigneeIdx].id,
      },
    });
  }

  // 10. Conversions
  console.log('Seeding conversions...');
  const conversions = [
    { leadIdx: 3, stage: 'onboarding', destination: 'APPOINTMENT_BOOKING' as const, value: 25000, status: 'COMPLETED' as const },
    { leadIdx: 0, stage: 'negotiation', destination: 'QUOTE_REQUEST' as const, value: 75000, status: 'REQUESTED' as const },
    { leadIdx: 6, stage: 'proposal_sent', destination: 'PURCHASE_ONLINE' as const, value: 50000, status: 'REQUESTED' as const },
    { leadIdx: 4, stage: 'qualification', destination: 'QUOTE_REQUEST' as const, value: 150000, status: 'REQUESTED' as const },
  ];
  for (const conv of conversions) {
    await prisma.conversion.create({
      data: {
        leadId: leads[conv.leadIdx].id,
        destination: conv.destination,
        status: conv.status,
        metadata: { stage: conv.stage, value: conv.value, notes: 'Standard conversion process' },
      },
    });
  }

  // 11. Lead Forms
  console.log('Seeding lead forms...');
  const form1 = await prisma.leadForm.create({
    data: { name: 'Contact Us', fields: { create: [
      { label: 'Full Name', fieldKey: 'full_name', type: 'text', required: true, displayOrder: 0 },
      { label: 'Email Address', fieldKey: 'email', type: 'email', required: true, displayOrder: 1 },
      { label: 'Phone Number', fieldKey: 'phone', type: 'phone', required: true, displayOrder: 2 },
      { label: 'Company Name', fieldKey: 'company', type: 'text', required: false, displayOrder: 3 },
      { label: 'Message', fieldKey: 'message', type: 'textarea', required: true, displayOrder: 4 },
    ]} },
  });
  const form2 = await prisma.leadForm.create({
    data: { name: 'Free Consultation', fields: { create: [
      { label: 'Name', fieldKey: 'name', type: 'text', required: true, displayOrder: 0 },
      { label: 'Email', fieldKey: 'email', type: 'email', required: true, displayOrder: 1 },
      { label: 'Phone', fieldKey: 'phone', type: 'phone', required: true, displayOrder: 2 },
      { label: 'Budget Range', fieldKey: 'budget', type: 'select', required: true, displayOrder: 3, options: JSON.stringify(['< 10K', '10K-50K', '50K-100K', '100K+']) },
      { label: 'Interested In', fieldKey: 'interest', type: 'select', required: false, displayOrder: 4, options: JSON.stringify(['Consulting', 'Automation', 'Marketing', 'Full Suite']) },
    ]} },
  });

  // 12. QR Codes
  console.log('Seeding QR codes...');
  await prisma.qrCode.createMany({
    data: [
      { name: 'Main Landing Page', destinationType: 'website', destination: 'https://deploysafe.in' },
      { name: 'Contact Form', destinationType: 'form_link', destination: `https://deploysafe.in/forms/${form1.id}` },
      { name: 'Consultation Booking', destinationType: 'form_link', destination: `https://deploysafe.in/forms/${form2.id}` },
    ],
  });

  // 13. Integrations
  console.log('Seeding integrations...');
  await prisma.integration.createMany({
    data: [
      { type: 'n8n', name: 'n8n Workflow Engine', config: { url: 'http://n8n:5678' }, isActive: true, status: 'connected', tenantId: TENANT_ID },
      { type: 'CALENDLY', name: 'Calendly Booking', config: { calendarLink: 'https://calendly.com/demo' }, isActive: false, status: 'disconnected', tenantId: TENANT_ID },
      { type: 'SMTP', name: 'Email Service', config: { host: 'smtp.example.com', port: 587 }, isActive: true, status: 'connected', tenantId: TENANT_ID },
    ],
  });

  // 14. Booking Settings
  console.log('Seeding booking settings...');
  await prisma.bookingSetting.upsert({
    where: { id: 'booking-calendly' },
    update: {},
    create: { id: 'booking-calendly', name: 'Calendly', provider: 'CALENDLY', config: { calendarLink: 'https://calendly.com/demo/30min' } },
  });

  // 15. Routing Rules
  console.log('Seeding routing rules...');
  await prisma.routingRule.createMany({
    data: [
      { name: 'Hot lead → senior agent', conditions: [{ field: 'segment', operator: 'equals', value: 'HOT' }], action: [{ type: 'assign_to', value: 'user-marcus' }] },
      { name: 'High budget → team lead', conditions: [{ field: 'budget', operator: 'contains', value: '100000' }], action: [{ type: 'assign_to', value: 'user-marcus' }] },
    ],
  });

  // 16. Failure Records
  console.log('Seeding failure records...');
  await prisma.failureRecord.createMany({
    data: [
      { type: 'MESSAGE_DELIVERY', status: 'open', severity: 'warning', entityType: 'conversation_message', message: 'Failed to send WhatsApp message: number not registered', attempts: 3, maxAttempts: 5, retryable: true },
      { type: 'WEBHOOK', status: 'open', severity: 'error', entityType: 'webhook', message: 'CRM webhook returned 500: timeout', attempts: 2, maxAttempts: 3, retryable: true },
      { type: 'INTEGRATION_SYNC', status: 'resolved', severity: 'warning', entityType: 'integration', message: 'Calendar sync conflict resolved automatically', attempts: 1, maxAttempts: 3, retryable: false },
    ],
  });

  // 17. Automation Rules
  console.log('Seeding automation rules...');
  await prisma.automationRule.createMany({
    data: [
      { name: 'Welcome hot leads', category: 'lead_routing', eventType: 'lead.created', conditions: { segment: ['HOT', 'WARM'] }, actions: { type: 'assign_agent', pool: ['user-sarah', 'user-priya'] }, active: true },
      { name: 'Follow up after 24h no reply', category: 'nurture', eventType: 'message.sent', conditions: { direction: 'OUTBOUND' }, actions: { type: 'schedule_nurture', sequence: seq1.id }, active: true },
    ],
  });

  console.log('✅ Mock data seeding complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
